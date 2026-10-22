package com.bibbidi.wedding.chat.evaluation.judge;

import com.bibbidi.wedding.chat.evaluation.data.prep.MetricInformation;
import com.bibbidi.wedding.chat.evaluation.data.result.JudgeInvocation;
import com.bibbidi.wedding.chat.evaluation.data.result.ModelTokenUsage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.evaluation.EvaluationResponse;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

public class ClaudeCliBibbidiJudge implements BibbidiJudge {

    private static final String RESULT_SCHEMA = "ai-evaluation/schema/judge-result.json";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String executable;
    private final String model;
    private final Duration timeout;

    public ClaudeCliBibbidiJudge(String model, Duration timeout) {
        this(System.getProperty("os.name").startsWith("Windows") ? "claude.exe" : "claude", model, timeout);
    }

    public ClaudeCliBibbidiJudge(String executable, String model, Duration timeout) {
        this.executable = executable;
        this.model = model;
        this.timeout = timeout;
    }

    @Override
    public EvaluationResponse evaluate(Prompt prompt, MetricInformation metric, String scenarioName) {
        try {
            return parseResult(runClaude(prompt), prompt, metric, scenarioName);
        } catch (IOException exception) {
            throw new IllegalStateException("Claude judge output could not be read", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Claude judge execution was interrupted", exception);
        }
    }

    EvaluationResponse parseResult(String json, Prompt prompt, MetricInformation metric, String scenarioName) {
        JsonNode envelope = objectMapper.readTree(json);
        JsonNode structuredOutput = envelope.get("structured_output");
        if (structuredOutput == null || !structuredOutput.isObject()) {
            throw new IllegalStateException("Claude judge returned no structured output");
        }
        String answer = structuredOutput.toString();
        JudgeInvocation invocation = new JudgeInvocation(prompt.getContents(), answer,
                ModelTokenUsage.fromClaude(envelope.get("usage")));
        return BibbidiJudgeResultParser.parse(answer, metric, scenarioName,
                Map.of("judgeModel", model, "judgeInvocation", invocation));
    }

    private String runClaude(Prompt prompt) throws IOException, InterruptedException {
        String schema;
        try (InputStream input = new ClassPathResource(RESULT_SCHEMA).getInputStream()) {
            schema = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        Path output = Files.createTempFile("bibbidi-claude-judge-", ".json");
        Path inputFile = Files.createTempFile("bibbidi-claude-judge-input-", ".txt");
        try {
            Files.writeString(inputFile, prompt.getContents(), StandardCharsets.UTF_8);
            // Windows 기본 모드는 직접 이스케이프하고, 엄격 모드(false)는 JDK의 처리를 따른다.
            boolean legacyWindowsArguments = System.getProperty("os.name").startsWith("Windows")
                    && !"false".equalsIgnoreCase(System.getProperty("jdk.lang.Process.allowAmbiguousCommands", "true"));
            String schemaArgument = legacyWindowsArguments ? schema.replace("\"", "\\\"") : schema;
            Process process = new ProcessBuilder(
                    executable, "-p", "--safe-mode", "--no-session-persistence",
                    "--tools", "", "--disallowedTools", "mcp__*",
                    "--model", model, "--output-format", "json", "--json-schema", schemaArgument)
                    .redirectInput(inputFile.toFile())
                    .redirectOutput(output.toFile())
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
            try {
                if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                    process.destroyForcibly().onExit().join();
                    throw new IllegalStateException("Claude judge timed out", new TimeoutException());
                }
            } catch (InterruptedException exception) {
                process.destroyForcibly().onExit().join();
                throw exception;
            }
            if (process.exitValue() != 0) {
                throw new IllegalStateException("Claude judge exited with code " + process.exitValue());
            }
            return Files.readString(output, StandardCharsets.UTF_8);
        } finally {
            Files.deleteIfExists(inputFile);
            Files.deleteIfExists(output);
        }
    }
}
