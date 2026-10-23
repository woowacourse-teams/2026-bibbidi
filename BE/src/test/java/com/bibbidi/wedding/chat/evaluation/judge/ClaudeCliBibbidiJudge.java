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

public class ClaudeCliBibbidiJudge implements BibbidiJudge {

    private static final String RESULT_SCHEMA = "ai-evaluation/schema/judge-result.json";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String executable;
    private final String model;
    private final CliProcess process;

    public ClaudeCliBibbidiJudge(String model, Duration timeout) {
        this(System.getProperty("os.name").startsWith("Windows") ? "claude.exe" : "claude", model, timeout);
    }

    public ClaudeCliBibbidiJudge(String executable, String model, Duration timeout) {
        this.executable = executable;
        this.model = model;
        this.process = new CliProcess(timeout, "Claude judge");
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
        try (CliWorkspace files = new CliWorkspace("bibbidi-claude-judge-")) {
            prepareInput(prompt, files);
            int exitCode = process.execute(prepareProcess(files));
            return readOutput(files, exitCode);
        }
    }

    private void prepareInput(Prompt prompt, CliWorkspace files) throws IOException {
        files.write("input.txt", prompt.getContents());
    }

    private ProcessBuilder prepareProcess(CliWorkspace files) throws IOException {
        String schema = new CliJsonSchema(RESULT_SCHEMA).asArgument();
        return new ProcessBuilder(
                executable, "-p", "--safe-mode", "--no-session-persistence",
                "--tools", "", "--disallowedTools", "mcp__*",
                "--model", model, "--output-format", "json", "--json-schema", schema)
                .redirectInput(files.path("input.txt").toFile())
                .redirectOutput(files.path("output.json").toFile());
    }

    private String readOutput(CliWorkspace files, int exitCode) throws IOException {
        if (exitCode != 0) {
            throw new IllegalStateException("Claude judge exited with code " + exitCode);
        }
        return files.read("output.json");
    }
}
