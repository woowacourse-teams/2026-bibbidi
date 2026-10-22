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

public class CodexCliBibbidiJudge implements BibbidiJudge {

    private static final String RESULT_SCHEMA = "ai-evaluation/schema/judge-result.json";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String executable;
    private final String model;
    private final String reasoningEffort;
    private final Duration timeout;

    public CodexCliBibbidiJudge(String model, String reasoningEffort, Duration timeout) {
        this(System.getProperty("os.name").startsWith("Windows") ? "codex.cmd" : "codex",
                model, reasoningEffort, timeout);
    }

    public CodexCliBibbidiJudge(String executable, String model, String reasoningEffort, Duration timeout) {
        this.executable = executable;
        this.model = model;
        this.reasoningEffort = reasoningEffort;
        this.timeout = timeout;
    }

    @Override
    public EvaluationResponse evaluate(Prompt prompt, MetricInformation metric, String scenarioName) {
        try {
            CodexOutput output = runCodex(prompt);
            JudgeInvocation invocation = new JudgeInvocation(prompt.getContents(), output.answer(), output.usage());
            return BibbidiJudgeResultParser.parse(output.answer(), metric, scenarioName,
                    Map.of("judgeModel", model, "reasoningEffort", reasoningEffort,
                            "judgeInvocation", invocation));
        } catch (IOException exception) {
            throw new IllegalStateException("Codex judge output could not be read", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Codex judge execution was interrupted", exception);
        }
    }

    private CodexOutput runCodex(Prompt prompt) throws IOException, InterruptedException {
        Path directory = Files.createTempDirectory("bibbidi-judge-");
        Path schema = directory.resolve("schema.json");
        Path inputFile = directory.resolve("input.txt");
        Path answer = directory.resolve("answer.json");
        Path events = directory.resolve("events.jsonl");
        try {
            Files.writeString(inputFile, prompt.getContents(), StandardCharsets.UTF_8);
            try (InputStream input = new ClassPathResource(RESULT_SCHEMA).getInputStream()) {
                Files.copy(input, schema);
            }
            Process process = new ProcessBuilder(
                    executable, "exec", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules",
                    "--sandbox", "read-only", "--model", model,
                    "--config", "model_reasoning_effort=" + reasoningEffort,
                    "--output-schema", schema.toString(),
                    "--output-last-message", answer.toString(), "-")
                    .redirectInput(inputFile.toFile())
                    .redirectOutput(events.toFile())
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
            try {
                if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                    process.destroyForcibly().onExit().join();
                    throw new IllegalStateException("Codex judge timed out", new TimeoutException());
                }
            } catch (InterruptedException exception) {
                process.destroyForcibly().onExit().join();
                throw exception;
            }
            if (process.exitValue() != 0) {
                throw new IllegalStateException("Codex judge exited with code " + process.exitValue());
            }
            String answerText = Files.readString(answer, StandardCharsets.UTF_8);
            return new CodexOutput(answerText, tokenUsage(Files.readString(events, StandardCharsets.UTF_8)));
        } finally {
            Files.deleteIfExists(inputFile);
            Files.deleteIfExists(answer);
            Files.deleteIfExists(events);
            Files.deleteIfExists(schema);
            Files.deleteIfExists(directory);
        }
    }

    private ModelTokenUsage tokenUsage(String events) {
        JsonNode usage = null;
        for (String line : events.lines().toList()) {
            if (line.isBlank()) {
                continue;
            }
            JsonNode event = objectMapper.readTree(line);
            if ("turn.completed".equals(event.path("type").asText())) {
                usage = event.get("usage");
            }
        }
        return ModelTokenUsage.fromCodex(usage);
    }

    private record CodexOutput(String answer, ModelTokenUsage usage) {
    }
}
