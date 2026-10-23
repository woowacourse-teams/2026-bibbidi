package com.bibbidi.wedding.chat.evaluation.local;

import com.bibbidi.wedding.chat.evaluation.claude.ClaudeCliChatModel;
import com.bibbidi.wedding.chat.evaluation.codex.CodexCliChatModel;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.judge.ClaudeCliBibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.judge.CodexCliBibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.report.BibbidiEvaluationReportWriter;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.springframework.ai.chat.model.ChatModel;

class LocalEvaluationSettings {

    private final Map<String, String> environment;

    LocalEvaluationSettings(Map<String, String> environment) {
        this.environment = Map.copyOf(environment);
        if (!environment.containsKey("BIBBIDI_LOCAL_EVALUATION_INPUT")
                || !environment.containsKey("BIBBIDI_EVALUATION_GENERATION_MODEL")) {
            throw new IllegalArgumentException(
                    "Set BIBBIDI_LOCAL_EVALUATION_INPUT and BIBBIDI_EVALUATION_GENERATION_MODEL");
        }
    }

    Path inputPath() {
        return Path.of(environment.get("BIBBIDI_LOCAL_EVALUATION_INPUT"));
    }

    ChatModel createAnswerModel() {
        String selection = generationModel();
        String effort = generationReasoningEffort();
        Duration timeout = generationTimeout();
        if (selection.startsWith("codex/") && selection.length() > "codex/".length()) {
            return new CodexCliChatModel(selection.substring("codex/".length()), effort, timeout);
        }
        if (selection.startsWith("claude/") && selection.length() > "claude/".length()) {
            return new ClaudeCliChatModel(selection.substring("claude/".length()), timeout);
        }
        throw new IllegalArgumentException("Generation model must be codex/<model> or claude/<model>");
    }

    BibbidiJudge createJudge() {
        String provider = judgeProvider();
        return switch (provider) {
            case "codex" -> new CodexCliBibbidiJudge(judgeModel(), judgeReasoningEffort(), judgeTimeout());
            case "claude" -> new ClaudeCliBibbidiJudge(judgeModel(), judgeTimeout());
            default -> throw new IllegalArgumentException("Unknown judge provider: " + provider);
        };
    }

    Path createRunDirectoryPath() {
        String root = value("BIBBIDI_LOCAL_EVALUATION_REPORT_DIR", "build/reports/ai-local-evaluation");
        String executedAt = Instant.now().toString().replace(':', '-');
        return Path.of(root).resolve(executedAt);
    }

    BibbidiEvaluationReportWriter createReport(Path directory) {
        return new BibbidiEvaluationReportWriter(
                generationModel(), judgeProvider(), judgeModel(), judgeReasoningEffort(), directory);
    }

    Map<String, String> snapshot() {
        return Map.of(
                "generationModel", generationModel(),
                "generationReasoningEffort", generationReasoningEffort(),
                "generationTimeout", generationTimeout().toString(),
                "judgeProvider", judgeProvider(),
                "judgeModel", judgeModel(),
                "judgeReasoningEffort", judgeReasoningEffort(),
                "judgeTimeout", judgeTimeout().toString());
    }

    private String generationModel() {
        return environment.get("BIBBIDI_EVALUATION_GENERATION_MODEL");
    }

    private String generationReasoningEffort() {
        return value("BIBBIDI_EVALUATION_GENERATION_REASONING_EFFORT", "medium");
    }

    private Duration generationTimeout() {
        return Duration.parse(value("BIBBIDI_EVALUATION_GENERATION_TIMEOUT", "PT2M"));
    }

    private String judgeProvider() {
        return value("BIBBIDI_EVALUATION_JUDGE_PROVIDER", "codex");
    }

    private String judgeModel() {
        return value("BIBBIDI_EVALUATION_JUDGE_MODEL", "gpt-6-sol");
    }

    private String judgeReasoningEffort() {
        return value("BIBBIDI_EVALUATION_JUDGE_REASONING_EFFORT", "low");
    }

    private Duration judgeTimeout() {
        return Duration.parse(value("BIBBIDI_EVALUATION_JUDGE_TIMEOUT", "PT2M"));
    }

    private String value(String name, String fallback) {
        return environment.getOrDefault(name, fallback);
    }
}
