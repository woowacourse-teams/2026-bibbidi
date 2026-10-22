package com.bibbidi.wedding.chat.evaluation.codex;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
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
import org.springframework.core.io.ClassPathResource;
import reactor.core.publisher.Flux;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

public class CodexCliChatModel implements ChatModel {

    private static final String ANSWER_SCHEMA = "ai-evaluation/schema/chat-answer.json";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String executable;
    private final String model;
    private final String reasoningEffort;
    private final Duration timeout;

    public CodexCliChatModel(String model, String reasoningEffort, Duration timeout) {
        this(System.getProperty("os.name").startsWith("Windows") ? "codex.cmd" : "codex",
                model, reasoningEffort, timeout);
    }

    public CodexCliChatModel(String executable, String model, String reasoningEffort, Duration timeout) {
        this.executable = executable;
        this.model = model;
        this.reasoningEffort = reasoningEffort;
        this.timeout = timeout;
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
        Path directory = Files.createTempDirectory("bibbidi-codex-generation-");
        Path instructions = directory.resolve("instructions.md");
        Path input = directory.resolve("input.txt");
        Path schema = directory.resolve("schema.json");
        Path answer = directory.resolve("answer.json");
        Path events = directory.resolve("events.jsonl");
        try {
            Files.writeString(instructions, systemText(prompt), StandardCharsets.UTF_8);
            Files.writeString(input, transcript(prompt), StandardCharsets.UTF_8);
            try (InputStream schemaInput = new ClassPathResource(ANSWER_SCHEMA).getInputStream()) {
                Files.copy(schemaInput, schema);
            }
            Process process = new ProcessBuilder(
                    executable, "exec", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules",
                    "--skip-git-repo-check", "--sandbox", "read-only", "--model", model,
                    "--config", "model_reasoning_effort=" + reasoningEffort,
                    "--config", "model_instructions_file='" + instructions + "'",
                    "--output-schema", schema.toString(),
                    "--output-last-message", answer.toString(), "-")
                    .directory(directory.toFile())
                    .redirectInput(input.toFile())
                    .redirectOutput(events.toFile())
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
            try {
                if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                    process.destroyForcibly().onExit().join();
                    throw new IllegalStateException("Codex generation timed out", new TimeoutException());
                }
            } catch (InterruptedException exception) {
                process.destroyForcibly().onExit().join();
                throw exception;
            }
            String eventLog = Files.readString(events, StandardCharsets.UTF_8);
            if (process.exitValue() != 0) {
                throw new IllegalStateException("Codex generation failed: " + failureMessage(eventLog));
            }
            String text = Files.readString(answer, StandardCharsets.UTF_8);
            return new ChatResponse(
                    List.of(new Generation(new AssistantMessage(text))),
                    ChatResponseMetadata.builder()
                            .model(model)
                            .usage(usage(eventLog))
                            .build());
        } finally {
            Files.deleteIfExists(input);
            Files.deleteIfExists(instructions);
            Files.deleteIfExists(schema);
            Files.deleteIfExists(answer);
            Files.deleteIfExists(events);
            Files.deleteIfExists(directory);
        }
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

    private DefaultUsage usage(String eventLog) {
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

    private String failureMessage(String eventLog) {
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
