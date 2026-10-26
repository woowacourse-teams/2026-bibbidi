package com.bibbidi.wedding.chat.adapter.ai.config;

import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelRoute;
import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelRouter;
import com.bibbidi.wedding.chat.adapter.ai.memory.ExpiringChatMemoryRepository;
import com.bibbidi.wedding.chat.adapter.ai.prompt.SystemPrompt;
import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelRoutingProperties;
import com.bibbidi.wedding.chat.adapter.ai.tools.CatalogServiceAdapter;
import com.bibbidi.wedding.chat.adapter.ai.tools.ChecklistServiceAdapter;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import java.util.Map;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties({AiChatProperties.class, ModelRoutingProperties.class})
public class AiChatConfig {

    @Bean
    ChatClient aiChatClient(
            ChatClient.Builder chatClientBuilder,
            ChatMemory chatMemory,
            ChatOptions.Builder<?> structuredAnswerOptions,
            SystemPrompt systemPrompt,
            CatalogServiceAdapter catalogTools,
            ChecklistServiceAdapter checklistTools
    ) {
        return chatClientBuilder.defaultOptions(structuredAnswerOptions)
                .defaultSystem(systemPrompt.text())
                .defaultTools(catalogTools, checklistTools)
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
                .build();
    }

    @Bean
    ChatMemory chatMemory(AiChatProperties properties) {
        return MessageWindowChatMemory.builder()
                .chatMemoryRepository(
                        new ExpiringChatMemoryRepository(properties.conversationIdleTimeout())
                )
                .maxMessages(properties.memoryMaxMessages())
                .build();
    }

    @Bean
    public ChatModelRouter chatModelRouter(
            @Qualifier("aiChatClient") ChatClient bedrockClient,
            @Qualifier("qwenChatClient") ObjectProvider<ChatClient> qwenClient,
            @Qualifier("lunaChatClient") ObjectProvider<ChatClient> lunaClient,
            AiChatProperties properties,
            @Value("${bibbidi.evaluation.generation.model:}") String evaluationModel
    ) {
        if (!evaluationModel.isBlank()) {
            ChatModelRoute route = new ChatModelRoute(bedrockClient, evaluationModel, null);
            return new ChatModelRouter(Map.of(
                    ChatModelTier.QWEN, route,
                    ChatModelTier.LUNA, route,
                    ChatModelTier.SOL, route));
        }

        String schema = new BeanOutputConverter<>(ChatResult.Answer.class).getJsonSchema();
        ChatModelRoute qwen = new ChatModelRoute(qwenClient.getIfAvailable(() -> bedrockClient), properties.qwenModel(),
                () -> BedrockChatOptions.builder().model(properties.qwenModel()).outputSchema(schema));
        ChatModelRoute sol = new ChatModelRoute(bedrockClient, properties.solModel(),
                () -> BedrockChatOptions.builder().model(properties.solModel()).outputSchema(schema)
                        .requestParameters(strictJsonFormatParameters()));

        ChatClient openAiClient = lunaClient.getIfAvailable();
        // OpenAI 클라이언트가 없으면 Luna 요청도 Bedrock Sol 모델이 처리하므로, 기록하는 모델명도 Sol로 맞춘다.
        ChatModelRoute luna = openAiClient == null
                ? sol
                : new ChatModelRoute(openAiClient, properties.lunaModel(), null);
        return new ChatModelRouter(Map.of(
                ChatModelTier.QWEN, qwen,
                ChatModelTier.LUNA, luna,
                ChatModelTier.SOL, sol));
    }

    @Bean
    @Profile("!test & !evaluator")
    ChatClient lunaChatClient(
            @Value("${bibbidi.ai.chatbot.luna-api-key}") String apiKey,
            @Value("${bibbidi.ai.chatbot.luna-model}") String model,
            ChatMemory chatMemory,
            SystemPrompt systemPrompt,
            CatalogServiceAdapter catalogTools,
            ChecklistServiceAdapter checklistTools
    ) {
        String schema = new BeanOutputConverter<>(ChatResult.Answer.class).getJsonSchema();
        OpenAiChatModel chatModel = OpenAiChatModel.builder()
                .options(OpenAiChatOptions.builder()
                        .apiKey(apiKey)
                        .model(model)
                        .reasoningEffort("none")
                        .outputSchema(schema)
                        .strict(true)
                        .build())
                .build();
        return ChatClient.builder(chatModel)
                .defaultSystem(systemPrompt.text())
                .defaultTools(catalogTools, checklistTools)
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
                .build();
    }

    @Bean
    ChatOptions.Builder<?> structuredAnswerOptions(
            @Value("${spring.ai.bedrock.converse.chat.model}") String model
    ) {
        BeanOutputConverter<ChatResult.Answer> outputConverter = new BeanOutputConverter<>(ChatResult.Answer.class);
        BedrockChatOptions.Builder options = BedrockChatOptions.builder()
                .outputSchema(outputConverter.getJsonSchema());

        if (model.contains("openai.gpt-")) {
            options.requestParameters(strictJsonFormatParameters());
        }

        return options;
    }

    // requestParameters의 타입은 Map<String, String>이라 중첩된 값을 바로 넣을 수 없다.
    // 실제로는 값을 JSON으로 바꿔 보내므로, 타입 검사만 피해서 중첩된 맵을 넘긴다.
    @SuppressWarnings({"rawtypes", "unchecked"})
    private static Map<String, String> strictJsonFormatParameters() {
        Map<String, Object> parameters = Map.of(
                "text", Map.of(
                        "format", Map.of("strict", true)
                )
        );
        return (Map) parameters;
    }
}
