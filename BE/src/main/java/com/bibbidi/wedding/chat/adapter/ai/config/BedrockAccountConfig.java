package com.bibbidi.wedding.chat.adapter.ai.config;

import com.bibbidi.wedding.chat.adapter.ai.prompt.SystemPrompt;
import com.bibbidi.wedding.chat.adapter.ai.tools.CatalogServiceAdapter;
import com.bibbidi.wedding.chat.adapter.ai.tools.ChecklistServiceAdapter;
import io.micrometer.observation.ObservationRegistry;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.bedrock.converse.BedrockProxyChatModel;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.model.bedrock.autoconfigure.BedrockAwsConnectionProperties;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.InstanceProfileCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;

@Configuration(proxyBeanMethods = false)
@Profile("!test & !evaluator")
@ConditionalOnProperty(name = "bibbidi.ai.chatbot.accounts-enabled", havingValue = "true")
public class BedrockAccountConfig {

    // 자동 구성하는 Bedrock 클라이언트(Sol)는 환경 변수 키 대신 EC2의 IAM 역할만 사용한다.
    @Bean
    InstanceProfileCredentialsProvider solBedrockCredentialsProvider() {
        return InstanceProfileCredentialsProvider.builder().build();
    }

    @Bean
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
            ChecklistServiceAdapter checklistTools
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
                .toolCallingManager(toolCallingManager)
                .build();
        return ChatClient.builder(model)
                .defaultSystem(systemPrompt.text())
                .defaultTools(catalogTools, checklistTools)
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
                .build();
    }
}
