package com.bibbidi.wedding.chat.evaluation.claude;

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

public class ClaudeCliChatModel implements ChatModel {

    private static final String ANSWER_SCHEMA = "ai-evaluation/schema/chat-answer.json";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String executable;
    private final String model;
    private final Duration timeout;

    public ClaudeCliChatModel(String model, Duration timeout) {
        this(System.getProperty("os.name").startsWith("Windows") ? "claude.exe" : "claude", model, timeout);
    }

    public ClaudeCliChatModel(String executable, String model, Duration timeout) {
        this.executable = executable;
        this.model = model;
        this.timeout = timeout;
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
        String schema;
        try (InputStream input = new ClassPathResource(ANSWER_SCHEMA).getInputStream()) {
            schema = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        Path directory = Files.createTempDirectory("bibbidi-claude-generation-");
        Path instructions = directory.resolve("instructions.md");
        Path input = directory.resolve("input.txt");
        Path output = directory.resolve("output.json");
        try {
            Files.writeString(instructions, systemText(prompt), StandardCharsets.UTF_8);
            Files.writeString(input, transcript(prompt), StandardCharsets.UTF_8);
            // Windows 기본 모드는 직접 이스케이프하고, 엄격 모드(false)는 JDK의 처리를 따른다.
            boolean legacyWindowsArguments = System.getProperty("os.name").startsWith("Windows")
                    && !"false".equalsIgnoreCase(System.getProperty("jdk.lang.Process.allowAmbiguousCommands", "true"));
            String schemaArgument = legacyWindowsArguments ? schema.replace("\"", "\\\"") : schema;
            Process process = new ProcessBuilder(
                    executable, "-p", "--safe-mode", "--no-session-persistence",
                    "--tools", "", "--disallowedTools", "mcp__*",
                    "--model", model, "--system-prompt-file", instructions.toString(),
                    "--output-format", "json", "--json-schema", schemaArgument)
                    .directory(directory.toFile())
                    .redirectInput(input.toFile())
                    .redirectOutput(output.toFile())
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
            try {
                if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                    process.destroyForcibly().onExit().join();
                    throw new IllegalStateException("Claude generation timed out", new TimeoutException());
                }
            } catch (InterruptedException exception) {
                process.destroyForcibly().onExit().join();
                throw exception;
            }
            String result = Files.readString(output, StandardCharsets.UTF_8);
            if (result.isBlank()) {
                throw new IllegalStateException("Claude generation exited with code " + process.exitValue());
            }
            JsonNode envelope = objectMapper.readTree(result);
            if (process.exitValue() != 0 || envelope.path("is_error").asBoolean()) {
                throw new IllegalStateException("Claude generation failed: "
                        + envelope.path("result").asString("exit code " + process.exitValue()));
            }
            JsonNode structuredOutput = envelope.get("structured_output");
            if (structuredOutput == null || !structuredOutput.isObject()) {
                throw new IllegalStateException("Claude generation returned no structured output");
            }
            return new ChatResponse(
                    List.of(new Generation(new AssistantMessage(structuredOutput.toString()))),
                    ChatResponseMetadata.builder()
                            .model(model)
                            .usage(usage(envelope.get("usage")))
                            .build());
        } finally {
            Files.deleteIfExists(input);
            Files.deleteIfExists(instructions);
            Files.deleteIfExists(output);
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

    private DefaultUsage usage(JsonNode usage) {
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
