package com.bibbidi.wedding.chat.evaluation.codex;

import com.bibbidi.wedding.chat.evaluation.cli.CliJsonSchema;
import com.bibbidi.wedding.chat.evaluation.cli.CliProcess;
import com.bibbidi.wedding.chat.evaluation.cli.CliWorkspace;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import reactor.core.publisher.Flux;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

public class CodexCliChatModel implements ChatModel {

    private static final String ANSWER_SCHEMA = "ai-evaluation/schema/chat-answer.json";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String executable;
    private final String model;
    private final String reasoningEffort;
    private final CliProcess process;

    public CodexCliChatModel(String model, String reasoningEffort, Duration timeout) {
        this(System.getProperty("os.name").startsWith("Windows") ? "codex.cmd" : "codex",
                model, reasoningEffort, timeout);
    }

    public CodexCliChatModel(String executable, String model, String reasoningEffort, Duration timeout) {
        this.executable = executable;
        this.model = model;
        this.reasoningEffort = reasoningEffort;
        this.process = new CliProcess(timeout, "Codex generation");
    }

    @Override
    public ChatResponse call(Prompt prompt) {
        try {
            return runCodex(prompt);
        } catch (IOException exception) {
            throw new IllegalStateException("Codex generation output could not be read", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Codex generation was interrupted", exception);
        }
    }

    @Override
    public Flux<ChatResponse> stream(Prompt prompt) {
        return Flux.defer(() -> Flux.just(call(prompt)));
    }

    private ChatResponse runCodex(Prompt prompt) throws IOException, InterruptedException {
        try (CliWorkspace files = new CliWorkspace("bibbidi-codex-generation-")) {
            prepareInput(prompt, files);
            int exitCode = process.execute(prepareProcess(files));
            return readResponse(files, exitCode);
        }
    }

    private void prepareInput(Prompt prompt, CliWorkspace files) throws IOException {
        files.write("instructions.md", systemText(prompt));
        files.write("input.txt", transcript(prompt));
        new CliJsonSchema(ANSWER_SCHEMA).writeTo(files.path("schema.json"));
    }

    private ProcessBuilder prepareProcess(CliWorkspace files) {
        return new ProcessBuilder(
                executable, "exec", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules",
                "--skip-git-repo-check", "--sandbox", "read-only", "--model", model,
                "--config", "model_reasoning_effort=" + reasoningEffort,
                "--config", "model_instructions_file='" + files.path("instructions.md") + "'",
                "--output-schema", files.path("schema.json").toString(),
                "--output-last-message", files.path("answer.json").toString(), "-")
                .directory(files.directory().toFile())
                .redirectInput(files.path("input.txt").toFile())
                .redirectOutput(files.path("events.jsonl").toFile());
    }

    private ChatResponse readResponse(CliWorkspace files, int exitCode) throws IOException {
        String eventLog = files.read("events.jsonl");
        if (exitCode != 0) {
            throw new IllegalStateException("Codex generation failed: " + readFailureMessage(eventLog));
        }
        String answer = files.read("answer.json");
        return new ChatResponse(
                List.of(new Generation(new AssistantMessage(answer))),
                ChatResponseMetadata.builder().model(model).usage(readUsage(eventLog)).build());
    }

    private String systemText(Prompt prompt) {
        return prompt.getSystemMessages().stream()
                .map(Message::getText)
                .collect(Collectors.joining("\n\n"));
    }

    private String transcript(Prompt prompt) {
        return prompt.getInstructions().stream()
                .filter(message -> message.getMessageType() != MessageType.SYSTEM)
                .map(message -> "[" + message.getMessageType().getValue() + "]\n" + message.getText())
                .collect(Collectors.joining("\n\n"));
    }

    private DefaultUsage readUsage(String eventLog) {
        JsonNode usage = null;
        for (String line : eventLog.lines().toList()) {
            if (line.isBlank()) {
                continue;
            }
            JsonNode event = objectMapper.readTree(line);
            if ("turn.completed".equals(event.path("type").asText())) {
                usage = event.get("usage");
            }
        }
        if (usage == null || usage.isNull() || !usage.has("input_tokens") || !usage.has("output_tokens")) {
            return null;
        }
        return new DefaultUsage(usage.path("input_tokens").asInt(), usage.path("output_tokens").asInt(),
                null, usage, usage.has("cached_input_tokens") ? usage.path("cached_input_tokens").asLong() : null,
                null);
    }

    private String readFailureMessage(String eventLog) {
        String message = "exit without message";
        for (String line : eventLog.lines().toList()) {
            if (line.isBlank()) {
                continue;
            }
            JsonNode event = objectMapper.readTree(line);
            if ("turn.failed".equals(event.path("type").asText())) {
                message = event.path("error").path("message").asText(message);
            }
        }
        return message;
    }
}
