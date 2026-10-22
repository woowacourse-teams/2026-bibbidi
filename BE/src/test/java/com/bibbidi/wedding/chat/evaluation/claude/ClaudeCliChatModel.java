package com.bibbidi.wedding.chat.evaluation.claude;

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

public class ClaudeCliChatModel implements ChatModel {

    private static final String ANSWER_SCHEMA = "ai-evaluation/schema/chat-answer.json";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String executable;
    private final String model;
    private final CliProcess process;

    public ClaudeCliChatModel(String model, Duration timeout) {
        this(System.getProperty("os.name").startsWith("Windows") ? "claude.exe" : "claude", model, timeout);
    }

    public ClaudeCliChatModel(String executable, String model, Duration timeout) {
        this.executable = executable;
        this.model = model;
        this.process = new CliProcess(timeout, "Claude generation");
    }

    @Override
    public ChatResponse call(Prompt prompt) {
        try {
            return runClaude(prompt);
        } catch (IOException exception) {
            throw new IllegalStateException("Claude generation output could not be read", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Claude generation was interrupted", exception);
        }
    }

    @Override
    public Flux<ChatResponse> stream(Prompt prompt) {
        return Flux.defer(() -> Flux.just(call(prompt)));
    }

    private ChatResponse runClaude(Prompt prompt) throws IOException, InterruptedException {
        try (CliWorkspace files = new CliWorkspace("bibbidi-claude-generation-")) {
            prepareInput(prompt, files);
            int exitCode = process.execute(prepareProcess(files));
            return readResponse(files, exitCode);
        }
    }

    private void prepareInput(Prompt prompt, CliWorkspace files) throws IOException {
        files.write("instructions.md", systemText(prompt));
        files.write("input.txt", transcript(prompt));
    }

    private ProcessBuilder prepareProcess(CliWorkspace files) throws IOException {
        String schema = new CliJsonSchema(ANSWER_SCHEMA).asArgument();
        return new ProcessBuilder(
                executable, "-p", "--safe-mode", "--no-session-persistence",
                "--tools", "", "--disallowedTools", "mcp__*",
                "--model", model, "--system-prompt-file", files.path("instructions.md").toString(),
                "--output-format", "json", "--json-schema", schema)
                .directory(files.directory().toFile())
                .redirectInput(files.path("input.txt").toFile())
                .redirectOutput(files.path("output.json").toFile());
    }

    private ChatResponse readResponse(CliWorkspace files, int exitCode) throws IOException {
        String result = files.read("output.json");
        if (result.isBlank()) {
            throw new IllegalStateException("Claude generation exited with code " + exitCode);
        }
        JsonNode envelope = objectMapper.readTree(result);
        if (exitCode != 0 || envelope.path("is_error").asBoolean()) {
            throw new IllegalStateException("Claude generation failed: "
                    + envelope.path("result").asString("exit code " + exitCode));
        }
        return createResponse(envelope);
    }

    private ChatResponse createResponse(JsonNode envelope) {
        JsonNode answer = envelope.get("structured_output");
        if (answer == null || !answer.isObject()) {
            throw new IllegalStateException("Claude generation returned no structured output");
        }
        return new ChatResponse(
                List.of(new Generation(new AssistantMessage(answer.toString()))),
                ChatResponseMetadata.builder().model(model).usage(readUsage(envelope.get("usage"))).build());
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

    private DefaultUsage readUsage(JsonNode usage) {
        if (usage == null || usage.isNull() || !usage.has("input_tokens") || !usage.has("output_tokens")) {
            return null;
        }
        int input = usage.path("input_tokens").asInt();
        int output = usage.path("output_tokens").asInt();
        long cacheRead = usage.path("cache_read_input_tokens").asLong();
        long cacheWrite = usage.path("cache_creation_input_tokens").asLong();
        return new DefaultUsage(input, output, (int) (input + output + cacheRead + cacheWrite), usage,
                cacheRead, cacheWrite);
    }
}
