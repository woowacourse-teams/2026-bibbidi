package com.bibbidi.wedding.chat.evaluation.config;

import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelRouter;
import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelTarget;
import com.bibbidi.wedding.chat.adapter.ai.config.AiChatProperties;
import com.bibbidi.wedding.chat.adapter.ai.prompt.SystemPrompt;
import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import com.bibbidi.wedding.chat.adapter.ai.routing.JevClient;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelClassifier;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelRoutingCriteria;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelRoutingInstruction;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelRoutingProperties;
import com.bibbidi.wedding.chat.adapter.ai.tools.AppointmentServiceAdapter;
import com.bibbidi.wedding.chat.adapter.ai.tools.CatalogServiceAdapter;
import com.bibbidi.wedding.chat.adapter.ai.tools.ChecklistServiceAdapter;
import com.bibbidi.wedding.chat.evaluation.config.EvaluationProperties.GenerationProperties;
import com.bibbidi.wedding.chat.evaluation.config.EvaluationProperties.ModelProperties;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiEvaluator;
import com.bibbidi.wedding.chat.evaluation.model.ClaudeCliChatModel;
import com.bibbidi.wedding.chat.evaluation.model.CliChatModel;
import com.bibbidi.wedding.chat.evaluation.model.CodexCliChatModel;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import java.util.Map;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.ai.model.bedrock.autoconfigure.BedrockAwsConnectionConfiguration;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import reactor.core.publisher.Mono;

/**
 * 평가 환경의 모델 구성이다. low는 실제 Bedrock qwen 계정을 그대로 쓰고, medium(luna)과 high(sol)는 CLI 모델로 바꾼다.
 */
@TestConfiguration(proxyBeanMethods = false)
@Profile("evaluator")
// 서비스의 qwenChatClient가 쓰는 Bedrock 연결 설정이다. spring.ai.model.chat이 none이면 자동 구성되지 않는다.
@ImportAutoConfiguration(BedrockAwsConnectionConfiguration.class)
@EnableConfigurationProperties(EvaluationProperties.class)
public class EvaluationModelConfiguration {

    @Bean
    @Primary
    @ConditionalOnProperty(name = "bibbidi.evaluation.fixed-sol", havingValue = "true")
    ModelClassifier fixedSolClassifier(
            ChatMemory memory, ModelRoutingProperties properties, JevClient jev,
            ModelRoutingInstruction instruction, ModelRoutingCriteria criteria) {
        return new ModelClassifier(memory, properties, jev, instruction, criteria) {
            @Override
            public Mono<ChatModelTier> classify(String conversationKey, String userPrompt) {
                return Mono.just(ChatModelTier.HIGH);
            }
        };
    }

    /**
     * 자동 구성이 {@code ChatClient.Builder}를 만들 때 하나를 고를 수 있도록 sol 모델을 기본으로 둔다.
     */
    @Bean
    @Primary
    ChatModel solChatModel(EvaluationProperties properties, ToolCallingManager toolCallingManager) {
        return cliModel(properties.generation(), properties.generation().solModel(), toolCallingManager);
    }

    @Bean
    ChatModel lunaChatModel(EvaluationProperties properties, ToolCallingManager toolCallingManager) {
        return cliModel(properties.generation(), properties.generation().lunaModel(), toolCallingManager);
    }

    /**
     * 서비스의 {@code chatModelRouter} 대신 쓴다. 서비스 쪽 라우터는 그대로 두고 {@code @Primary}로 가린다.
     */
    @Bean
    @Primary
    ChatModelRouter evaluationChatModelRouter(
            @Qualifier("qwenChatClient") ChatClient qwenClient,
            @Qualifier("lunaChatModel") ChatModel lunaModel,
            @Qualifier("solChatModel") ChatModel solModel,
            ChatOptions.Builder<?> structuredAnswerOptions,
            ChatMemory chatMemory,
            SystemPrompt systemPrompt,
            CatalogServiceAdapter catalogTools,
            ChecklistServiceAdapter checklistTools,
            AppointmentServiceAdapter appointmentTools,
            AiChatProperties chatProperties,
            EvaluationProperties properties
    ) {
        String schema = new BeanOutputConverter<>(ChatResult.Answer.class).getJsonSchema();
        ChatModelTarget low = new ChatModelTarget(qwenClient, chatProperties.qwenModel(),
                () -> BedrockChatOptions.builder().model(chatProperties.qwenModel()).outputSchema(schema));
        ChatModelTarget medium = new ChatModelTarget(
                chatClient(lunaModel, structuredAnswerOptions, chatMemory, systemPrompt,
                        catalogTools, checklistTools, appointmentTools),
                properties.generation().lunaModel(), null);
        ChatModelTarget high = new ChatModelTarget(
                chatClient(solModel, structuredAnswerOptions, chatMemory, systemPrompt,
                        catalogTools, checklistTools, appointmentTools),
                properties.generation().solModel(), null);
        return new ChatModelRouter(Map.of(
                ChatModelTier.LOW, low,
                ChatModelTier.MEDIUM, medium,
                ChatModelTier.HIGH, high));
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

    private static CliChatModel cliModel(
            GenerationProperties generation, String model, ToolCallingManager toolCallingManager) {
        CliChatModel chatModel = switch (generation.provider()) {
            case "codex" -> new CodexCliChatModel(model, generation.reasoningEffort(), generation.timeout());
            case "claude" -> new ClaudeCliChatModel(model, generation.timeout());
            default -> throw new IllegalArgumentException("Unknown generation provider: " + generation.provider());
        };
        chatModel.useToolCallingManager(toolCallingManager);
        return chatModel;
    }

    private static ChatClient chatClient(
            ChatModel model,
            ChatOptions.Builder<?> structuredAnswerOptions,
            ChatMemory chatMemory,
            SystemPrompt systemPrompt,
            CatalogServiceAdapter catalogTools,
            ChecklistServiceAdapter checklistTools,
            AppointmentServiceAdapter appointmentTools
    ) {
        return ChatClient.builder(model)
                .defaultOptions(structuredAnswerOptions)
                .defaultSystem(systemPrompt.text())
                .defaultTools(catalogTools, checklistTools, appointmentTools)
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
                .build();
    }

    public record JudgeModel(ChatModel chatModel) {
    }
}
