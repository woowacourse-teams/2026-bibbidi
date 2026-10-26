package com.bibbidi.wedding.chat.adapter.ai.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.chat.adapter.ai.prompt.SystemPrompt;
import com.bibbidi.wedding.chat.adapter.ai.tools.CatalogServiceAdapter;
import com.bibbidi.wedding.chat.adapter.ai.tools.ChecklistServiceAdapter;
import io.micrometer.observation.ObservationRegistry;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.model.bedrock.autoconfigure.BedrockAwsConnectionConfiguration;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.InstanceProfileCredentialsProvider;

class BedrockAccountConfigTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(BedrockAccountConfig.class)
            .withConfiguration(AutoConfigurations.of(BedrockAwsConnectionConfiguration.class))
            .withBean(AiChatProperties.class, () -> new AiChatProperties(
                    10, Duration.ofHours(1), "qwen-test", "sol-test", "luna-test"))
            .withBean(ObservationRegistry.class, ObservationRegistry::create)
            .withBean(ToolCallingManager.class, () -> ToolCallingManager.builder().build())
            .withBean(ChatMemory.class, () -> MessageWindowChatMemory.builder().build())
            .withBean(SystemPrompt.class, SystemPrompt::new)
            .withBean(CatalogServiceAdapter.class, () -> new CatalogServiceAdapter(mock(CatalogService.class)))
            .withBean(ChecklistServiceAdapter.class, () -> mock(ChecklistServiceAdapter.class))
            .withPropertyValues(
                    "spring.profiles.active=prod",
                    "bibbidi.ai.chatbot.accounts-enabled=true",
                    "bibbidi.ai.chatbot.qwen-access-key=test-qwen-access-key",
                    "bibbidi.ai.chatbot.qwen-secret-key=test-qwen-secret-key",
                    "bibbidi.ai.chatbot.qwen-region=ap-northeast-1",
                    "spring.ai.bedrock.converse.chat.max-tokens=2048",
                    "spring.ai.bedrock.aws.region=ap-northeast-1");

    @Test
    void keepsSolOnTheInstanceRoleEvenWhenGlobalBedrockKeysAreConfigured() {
        runner.withPropertyValues(
                "spring.ai.bedrock.aws.access-key=unrelated-access-key",
                "spring.ai.bedrock.aws.secret-key=unrelated-secret-key")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(AwsCredentialsProvider.class);
                    assertThat(context.getBean(AwsCredentialsProvider.class))
                            .isInstanceOf(InstanceProfileCredentialsProvider.class);
                    assertThat(context.getBean("qwenChatClient")).isInstanceOf(ChatClient.class);
                });
    }

    @Test
    void enablesSeparateAccountsOnTheDevelopmentServerWhenExplicitlyConfigured() {
        runner.withPropertyValues("spring.profiles.active=dev")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasBean("qwenChatClient");
                    assertThat(context.getBean(AwsCredentialsProvider.class))
                            .isInstanceOf(InstanceProfileCredentialsProvider.class);
                });
    }

    @Test
    void rejectsAnEmptyQwenKeyInsteadOfUsingTheSolAccount() {
        runner.withPropertyValues("bibbidi.ai.chatbot.qwen-access-key=")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseMessage("Access key ID cannot be blank.");
                });
    }

    @Test
    void keepsLocalDevelopmentOnTheExistingClientByDefault() {
        new ApplicationContextRunner()
                .withUserConfiguration(BedrockAccountConfig.class)
                .withPropertyValues("spring.profiles.active=dev")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).doesNotHaveBean("qwenChatClient");
                    assertThat(context).doesNotHaveBean("solBedrockCredentialsProvider");
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {"test", "evaluator", "prod,test", "prod,evaluator"})
    void excludesProductionAccountsFromTestAndEvaluationProfiles(String profiles) {
        new ApplicationContextRunner()
                .withUserConfiguration(BedrockAccountConfig.class)
                .withPropertyValues(
                        "spring.profiles.active=" + profiles,
                        "bibbidi.ai.chatbot.accounts-enabled=true")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).doesNotHaveBean("qwenChatClient");
                    assertThat(context).doesNotHaveBean("solBedrockCredentialsProvider");
                });
    }
}
