package com.bibbidi.wedding.balancegame.adapter.ai.config;

import com.bibbidi.wedding.balancegame.adapter.ai.client.BalanceGameModelTarget;
import com.bibbidi.wedding.balancegame.adapter.ai.prompt.BalanceGameSystemPrompt;
import io.micrometer.observation.ObservationRegistry;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.bedrock.converse.BedrockProxyChatModel;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.model.bedrock.autoconfigure.BedrockAwsConnectionProperties;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;

@Configuration(proxyBeanMethods = false)
public class BalanceGameAiConfig {

    private static final String REASONING_EFFORT_NONE = "none";

    @Bean
    @ConditionalOnProperty(name = "bibbidi.ai.chatbot.accounts-enabled", havingValue = "true")
    ChatClient balanceGameQwenAccountClient(
            @Value("${bibbidi.ai.chatbot.qwen-access-key}") String accessKey,
            @Value("${bibbidi.ai.chatbot.qwen-secret-key}") String secretKey,
            @Value("${bibbidi.ai.chatbot.qwen-region}") String region,
            @Value("${bibbidi.ai.chatbot.qwen-model}") String model,
            @Value("${spring.ai.bedrock.converse.chat.max-tokens}") int maxTokens,
            BedrockAwsConnectionProperties connection,
            ObservationRegistry observationRegistry,
            BalanceGameSystemPrompt systemPrompt
    ) {
        BedrockProxyChatModel chatModel = BedrockProxyChatModel.builder()
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
                .region(Region.of(region))
                .timeout(connection.getTimeout())
                .connectionTimeout(connection.getConnectionTimeout())
                .asyncReadTimeout(connection.getAsyncReadTimeout())
                .connectionAcquisitionTimeout(connection.getConnectionAcquisitionTimeout())
                .socketTimeout(connection.getSocketTimeout())
                .options(BedrockChatOptions.builder().model(model).maxTokens(maxTokens).build())
                .observationRegistry(observationRegistry)
                .build();
        return ChatClient.builder(chatModel)
                .defaultSystem(systemPrompt.text())
                .build();
    }

    @Bean
    @ConditionalOnProperty(name = "bibbidi.ai.balance-game.model", havingValue = "qwen")
    BalanceGameModelTarget balanceGameQwenTarget(
            @Qualifier("balanceGameQwenAccountClient") ObjectProvider<ChatClient> accountClient,
            ChatClient.Builder chatClientBuilder,
            @Value("${bibbidi.ai.chatbot.qwen-model}") String model,
            BalanceGameSystemPrompt systemPrompt
    ) {
        ChatClient client = accountClient.getIfAvailable(
                () -> chatClientBuilder.defaultSystem(systemPrompt.text()).build());
        return new BalanceGameModelTarget(client, schema -> BedrockChatOptions.builder()
                .model(model)
                .outputSchema(schema));
    }

    @Bean
    @ConditionalOnProperty(name = "bibbidi.ai.balance-game.model", havingValue = "luna")
    BalanceGameModelTarget balanceGameLunaTarget(
            @Value("${bibbidi.ai.chatbot.luna-api-key}") String apiKey,
            @Value("${bibbidi.ai.chatbot.luna-model}") String model,
            BalanceGameSystemPrompt systemPrompt
    ) {
        OpenAiChatModel chatModel = OpenAiChatModel.builder()
                .options(OpenAiChatOptions.builder()
                        .apiKey(apiKey)
                        .model(model)
                        .reasoningEffort(REASONING_EFFORT_NONE)
                        .build())
                .build();
        ChatClient client = ChatClient.builder(chatModel)
                .defaultSystem(systemPrompt.text())
                .build();
        return new BalanceGameModelTarget(client, schema -> OpenAiChatOptions.builder()
                .apiKey(apiKey)
                .model(model)
                .reasoningEffort(REASONING_EFFORT_NONE)
                .outputSchema(schema)
                .strict(true));
    }
}
