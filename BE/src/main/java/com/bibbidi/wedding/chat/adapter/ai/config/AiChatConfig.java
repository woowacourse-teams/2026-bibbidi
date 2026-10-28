package com.bibbidi.wedding.chat.adapter.ai.config;

import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelTarget;
import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelRouter;
import com.bibbidi.wedding.chat.adapter.ai.memory.ExpiringChatMemoryRepository;
import com.bibbidi.wedding.chat.adapter.ai.prompt.SystemPrompt;
import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import com.bibbidi.wedding.chat.adapter.ai.routing.JevClient;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelRoutingProperties;
import com.bibbidi.wedding.chat.adapter.ai.tools.AppointmentServiceAdapter;
import com.bibbidi.wedding.chat.adapter.ai.tools.BibbidiToolCallingManager;
import com.bibbidi.wedding.chat.adapter.ai.tools.CatalogServiceAdapter;
import com.bibbidi.wedding.chat.adapter.ai.tools.ChecklistServiceAdapter;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import io.micrometer.observation.ObservationRegistry;
import java.util.Map;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.bedrock.converse.BedrockProxyChatModel;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.client.advisor.ToolCallingAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.ai.model.bedrock.autoconfigure.BedrockAwsConnectionProperties;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.InstanceProfileCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties({AiChatProperties.class, ModelRoutingProperties.class})
public class AiChatConfig {

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
    @ConditionalOnProperty(name = "bibbidi.ai.chatbot.jev-tool-loop.enabled", havingValue = "true")
    ToolCallingManager toolCallingManager(ModelRoutingProperties properties, JevClient jev) {
        return new BibbidiToolCallingManager(ToolCallingManager.builder().build(), properties, jev);
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

    @Bean
    ChatClient aiChatClient(
            ChatClient.Builder chatClientBuilder,
            ChatMemory chatMemory,
            ChatOptions.Builder<?> structuredAnswerOptions,
            SystemPrompt systemPrompt,
            CatalogServiceAdapter catalogTools,
            ChecklistServiceAdapter checklistTools,
            AppointmentServiceAdapter appointmentTools
    ) {
        return chatClientBuilder.defaultOptions(structuredAnswerOptions)
                .defaultSystem(systemPrompt.text())
                .defaultTools(catalogTools, checklistTools, appointmentTools)
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
                .build();
    }

    // 자동 구성하는 Bedrock 클라이언트(Sol)는 환경 변수 키 대신 EC2의 IAM 역할만 사용한다.
    @Bean
    @ConditionalOnProperty(name = "bibbidi.ai.chatbot.accounts-enabled", havingValue = "true")
    InstanceProfileCredentialsProvider solBedrockCredentialsProvider() {
        return InstanceProfileCredentialsProvider.builder().build();
    }

    @Bean
    @ConditionalOnProperty(name = "bibbidi.ai.chatbot.accounts-enabled", havingValue = "true")
    ChatClient qwenChatClient(
            @Value("${bibbidi.ai.chatbot.qwen-access-key}") String accessKey,
            @Value("${bibbidi.ai.chatbot.qwen-secret-key}") String secretKey,
            @Value("${bibbidi.ai.chatbot.qwen-region}") String region,
            @Value("${spring.ai.bedrock.converse.chat.max-tokens}") int maxTokens,
            AiChatProperties properties,
            BedrockAwsConnectionProperties connection,
            ObservationRegistry observationRegistry,
            ToolCallingManager toolCallingManager,
            ChatMemory chatMemory,
            SystemPrompt systemPrompt,
            CatalogServiceAdapter catalogTools,
            ChecklistServiceAdapter checklistTools,
            AppointmentServiceAdapter appointmentTools
    ) {
        BedrockProxyChatModel model = BedrockProxyChatModel.builder()
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
                .region(Region.of(region))
                .timeout(connection.getTimeout())
                .connectionTimeout(connection.getConnectionTimeout())
                .asyncReadTimeout(connection.getAsyncReadTimeout())
                .connectionAcquisitionTimeout(connection.getConnectionAcquisitionTimeout())
                .socketTimeout(connection.getSocketTimeout())
                .options(BedrockChatOptions.builder().model(properties.qwenModel()).maxTokens(maxTokens).build())
                .observationRegistry(observationRegistry)
                .build();
        return ChatClient.builder(model)
                .defaultSystem(systemPrompt.text())
                .defaultTools(catalogTools, checklistTools, appointmentTools)
                .defaultAdvisors(
                        MessageChatMemoryAdvisor.builder(chatMemory).build(),
                        ToolCallingAdvisor.builder().toolCallingManager(toolCallingManager).build())
                .build();
    }

    @Bean
    @Profile("!dev")
    @ConditionalOnProperty(name = "bibbidi.ai.chatbot.accounts-enabled", havingValue = "true")
    ChatClient lunaChatClient(
            @Value("${bibbidi.ai.chatbot.luna-api-key}") String apiKey,
            @Value("${bibbidi.ai.chatbot.luna-model}") String model,
            ChatMemory chatMemory,
            SystemPrompt systemPrompt,
            CatalogServiceAdapter catalogTools,
            ChecklistServiceAdapter checklistTools,
            AppointmentServiceAdapter appointmentTools
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
                .defaultTools(catalogTools, checklistTools, appointmentTools)
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
                .build();
    }

    @Bean
    public ChatModelRouter chatModelRouter(
            @Qualifier("aiChatClient") ChatClient bedrockClient,
            @Qualifier("qwenChatClient") ObjectProvider<ChatClient> qwenClient,
            @Qualifier("lunaChatClient") ObjectProvider<ChatClient> lunaClient,
            AiChatProperties properties,
            @Value("${bibbidi.evaluation.generation.model:}") String evaluationModel,
            Environment environment
    ) {
        if (!evaluationModel.isBlank()) {
            ChatModelTarget target = new ChatModelTarget(bedrockClient, evaluationModel, null);
            return new ChatModelRouter(Map.of(
                    ChatModelTier.LOW, target,
                    ChatModelTier.MEDIUM, target,
                    ChatModelTier.HIGH, target));
        }

        String schema = new BeanOutputConverter<>(ChatResult.Answer.class).getJsonSchema();
        ChatClient accountQwenClient = qwenClient.getIfAvailable();
        ChatClient selectedQwenClient = bedrockClient;
        if (accountQwenClient != null) {
            selectedQwenClient = accountQwenClient;
        }
        ChatModelTarget qwen = new ChatModelTarget(selectedQwenClient, properties.qwenModel(),
                () -> BedrockChatOptions.builder().model(properties.qwenModel()).outputSchema(schema));
        // dev는 Qwen만 사용한다. 폴백도 Sol·Luna로 넘어가지 않도록 모든 티어를 Qwen으로 둔다.
        if (accountQwenClient == null || environment.acceptsProfiles(Profiles.of("dev"))) {
            return new ChatModelRouter(Map.of(
                    ChatModelTier.LOW, qwen,
                    ChatModelTier.MEDIUM, qwen,
                    ChatModelTier.HIGH, qwen));
        }
        ChatModelTarget sol = new ChatModelTarget(bedrockClient, properties.solModel(),
                () -> BedrockChatOptions.builder().model(properties.solModel()).outputSchema(schema)
                        .requestParameters(strictJsonFormatParameters()));

        ChatClient openAiClient = lunaClient.getIfAvailable();
        ChatModelTarget luna = sol;
        if (openAiClient != null) {
            luna = new ChatModelTarget(openAiClient, properties.lunaModel(), null);
        }
        return new ChatModelRouter(Map.of(
                ChatModelTier.LOW, qwen,
                ChatModelTier.MEDIUM, luna,
                ChatModelTier.HIGH, sol));
    }

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
