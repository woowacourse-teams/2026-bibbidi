package com.bibbidi.wedding.chat.evaluation.config;

import com.bibbidi.wedding.chat.evaluation.config.EvaluationProperties.ModelProperties;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiEvaluator;
import com.bibbidi.wedding.chat.evaluation.model.ClaudeCliChatModel;
import com.bibbidi.wedding.chat.evaluation.model.CodexCliChatModel;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/**
 * 평가에 쓰는 생성 모델과 판정 모델을 설정에서 골라 만든다.
 */
@TestConfiguration(proxyBeanMethods = false)
@EnableConfigurationProperties(EvaluationProperties.class)
public class EvaluationModelConfiguration {

    /**
     * 서비스의 {@code aiChatClient}가 쓰는 {@code ChatModel}이다. Bedrock 대신 이 모델을 쓴다.
     */
    @Bean
    ChatModel generationChatModel(EvaluationProperties properties) {
        ModelProperties generation = properties.generation();
        return switch (generation.provider()) {
            case "codex" -> new CodexCliChatModel(
                    generation.model(), generation.reasoningEffort(), generation.timeout());
            case "claude" -> new ClaudeCliChatModel(generation.model(), generation.timeout());
            default -> throw new IllegalArgumentException("Unknown generation provider: " + generation.provider());
        };
    }

    /**
     * 판정 모델은 {@code ChatModel}로 등록하면 서비스가 쓰는 {@code ChatModel}과 섞이므로, 감싼 타입으로 등록한다.
     */
    @Bean
    JudgeModel judgeModel(EvaluationProperties properties) {
        ModelProperties judge = properties.judge();
        return new JudgeModel(switch (judge.provider()) {
            case "codex" -> CodexCliChatModel.structured(
                    judge.model(), judge.reasoningEffort(), judge.timeout(), BibbidiEvaluator.JUDGE_RESULT_SCHEMA);
            case "claude" -> ClaudeCliChatModel.structured(
                    judge.model(), judge.timeout(), BibbidiEvaluator.JUDGE_RESULT_SCHEMA);
            default -> throw new IllegalArgumentException("Unknown judge provider: " + judge.provider());
        });
    }

    public record JudgeModel(ChatModel chatModel) {
    }
}
