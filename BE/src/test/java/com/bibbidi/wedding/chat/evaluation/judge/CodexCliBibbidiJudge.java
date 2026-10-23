package com.bibbidi.wedding.chat.evaluation.judge;

import com.bibbidi.wedding.chat.evaluation.cli.CliJsonSchema;
import com.bibbidi.wedding.chat.evaluation.cli.CliProcess;
import com.bibbidi.wedding.chat.evaluation.cli.CliWorkspace;
import com.bibbidi.wedding.chat.evaluation.data.prep.MetricInformation;
import com.bibbidi.wedding.chat.evaluation.data.result.JudgeInvocation;
import com.bibbidi.wedding.chat.evaluation.data.result.ModelTokenUsage;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.evaluation.EvaluationResponse;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

public class CodexCliBibbidiJudge implements BibbidiJudge {

    private static final String RESULT_SCHEMA = "ai-evaluation/schema/judge-result.json";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String executable;
    private final String model;
    private final String reasoningEffort;
    private final CliProcess process;

    public CodexCliBibbidiJudge(String model, String reasoningEffort, Duration timeout) {
        this(System.getProperty("os.name").startsWith("Windows") ? "codex.cmd" : "codex",
                model, reasoningEffort, timeout);
    }

    public CodexCliBibbidiJudge(String executable, String model, String reasoningEffort, Duration timeout) {
        this.executable = executable;
        this.model = model;
        this.reasoningEffort = reasoningEffort;
        this.process = new CliProcess(timeout, "Codex judge");
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
        try (CliWorkspace files = new CliWorkspace("bibbidi-judge-")) {
            prepareInput(prompt, files);
            int exitCode = process.execute(prepareProcess(files));
            return readOutput(files, exitCode);
        }
    }

    private void prepareInput(Prompt prompt, CliWorkspace files) throws IOException {
        files.write("input.txt", prompt.getContents());
        new CliJsonSchema(RESULT_SCHEMA).writeTo(files.path("schema.json"));
    }

    private ProcessBuilder prepareProcess(CliWorkspace files) {
        return new ProcessBuilder(
                executable, "exec", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules",
                "--sandbox", "read-only", "--model", model,
                "--config", "model_reasoning_effort=" + reasoningEffort,
                "--output-schema", files.path("schema.json").toString(),
                "--output-last-message", files.path("answer.json").toString(), "-")
                .redirectInput(files.path("input.txt").toFile())
                .redirectOutput(files.path("events.jsonl").toFile());
    }

    private CodexOutput readOutput(CliWorkspace files, int exitCode) throws IOException {
        if (exitCode != 0) {
            throw new IllegalStateException("Codex judge exited with code " + exitCode);
        }
        String answer = files.read("answer.json");
        String events = files.read("events.jsonl");
        return new CodexOutput(answer, tokenUsage(events));
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
