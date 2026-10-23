package com.bibbidi.wedding.chat.evaluation.local;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class LocalEvaluationSettingsTest {

    @Test
    @DisplayName("선택한 답변 모델과 기본 채점 설정을 실행 기록에 남긴다")
    void snapshotsDefaultModelSettings() {
        LocalEvaluationSettings settings = new LocalEvaluationSettings(Map.of(
                "BIBBIDI_LOCAL_EVALUATION_INPUT", "example.json",
                "BIBBIDI_EVALUATION_GENERATION_MODEL", "codex/answer-model"));

        assertThat(settings.inputPath()).isEqualTo(Path.of("example.json"));
        assertThat(settings.snapshot()).containsExactlyInAnyOrderEntriesOf(Map.of(
                "generationModel", "codex/answer-model",
                "generationReasoningEffort", "medium",
                "generationTimeout", "PT2M",
                "judgeProvider", "codex",
                "judgeModel", "gpt-6-sol",
                "judgeReasoningEffort", "low",
                "judgeTimeout", "PT2M"));
    }

    @Test
    @DisplayName("환경 변수로 바꾼 답변과 채점 설정을 기본값 대신 기록한다")
    void snapshotsOverriddenModelSettings() {
        LocalEvaluationSettings settings = new LocalEvaluationSettings(Map.of(
                "BIBBIDI_LOCAL_EVALUATION_INPUT", "example.json",
                "BIBBIDI_EVALUATION_GENERATION_MODEL", "claude/answer-model",
                "BIBBIDI_EVALUATION_GENERATION_REASONING_EFFORT", "high",
                "BIBBIDI_EVALUATION_GENERATION_TIMEOUT", "PT5M",
                "BIBBIDI_EVALUATION_JUDGE_PROVIDER", "claude",
                "BIBBIDI_EVALUATION_JUDGE_MODEL", "judge-model",
                "BIBBIDI_EVALUATION_JUDGE_REASONING_EFFORT", "medium",
                "BIBBIDI_EVALUATION_JUDGE_TIMEOUT", "PT3M"));

        assertThat(settings.snapshot()).containsExactlyInAnyOrderEntriesOf(Map.of(
                "generationModel", "claude/answer-model",
                "generationReasoningEffort", "high",
                "generationTimeout", "PT5M",
                "judgeProvider", "claude",
                "judgeModel", "judge-model",
                "judgeReasoningEffort", "medium",
                "judgeTimeout", "PT3M"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"BIBBIDI_LOCAL_EVALUATION_INPUT", "BIBBIDI_EVALUATION_GENERATION_MODEL"})
    @DisplayName("필수 환경 변수가 빠지면 평가를 준비하기 전에 실패한다")
    void rejectsMissingRequiredSettings(String missingSetting) {
        Map<String, String> environment = new HashMap<>(Map.of(
                "BIBBIDI_LOCAL_EVALUATION_INPUT", "example.json",
                "BIBBIDI_EVALUATION_GENERATION_MODEL", "codex/answer-model"));
        environment.remove(missingSetting);

        assertThatThrownBy(() -> new LocalEvaluationSettings(environment))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(missingSetting);
    }

    @ParameterizedTest
    @ValueSource(strings = {"codex/", "claude/", "unknown/model"})
    @DisplayName("지원하지 않거나 모델 이름이 없는 답변 설정을 거절한다")
    void rejectsInvalidAnswerModels(String selection) {
        LocalEvaluationSettings settings = new LocalEvaluationSettings(Map.of(
                "BIBBIDI_LOCAL_EVALUATION_INPUT", "example.json",
                "BIBBIDI_EVALUATION_GENERATION_MODEL", selection));

        assertThatThrownBy(settings::createAnswerModel)
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("지원하지 않는 채점 CLI를 거절한다")
    void rejectsUnknownJudgeProvider() {
        LocalEvaluationSettings settings = new LocalEvaluationSettings(Map.of(
                "BIBBIDI_LOCAL_EVALUATION_INPUT", "example.json",
                "BIBBIDI_EVALUATION_GENERATION_MODEL", "codex/answer-model",
                "BIBBIDI_EVALUATION_JUDGE_PROVIDER", "unknown"));

        assertThatThrownBy(settings::createJudge)
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Unknown judge provider: unknown");
    }
}
