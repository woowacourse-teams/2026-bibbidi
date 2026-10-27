package com.bibbidi.wedding.chat.adapter.ai.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.chat.adapter.ai.prompt.SystemPrompt;
import com.bibbidi.wedding.chat.adapter.ai.tools.AppointmentServiceAdapter;
import com.bibbidi.wedding.chat.adapter.ai.tools.CatalogServiceAdapter;
import com.bibbidi.wedding.chat.adapter.ai.tools.ChecklistServiceAdapter;
import io.micrometer.observation.ObservationRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.model.bedrock.autoconfigure.BedrockAwsConnectionConfiguration;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.InstanceProfileCredentialsProvider;

class AiChatConfigTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(AiChatConfig.class)
            .withConfiguration(AutoConfigurations.of(BedrockAwsConnectionConfiguration.class))
            .withBean(ChatClient.Builder.class, () -> ChatClient.builder(mock(ChatModel.class)))
            .withBean(ObservationRegistry.class, ObservationRegistry::create)
            .withBean(ToolCallingManager.class, () -> ToolCallingManager.builder().build())
            .withBean(SystemPrompt.class, SystemPrompt::new)
            .withBean(CatalogServiceAdapter.class, () -> new CatalogServiceAdapter(mock(CatalogService.class)))
            .withBean(ChecklistServiceAdapter.class, () -> mock(ChecklistServiceAdapter.class))
            .withBean(AppointmentServiceAdapter.class, () -> mock(AppointmentServiceAdapter.class))
            .withPropertyValues(
                    "spring.profiles.active=prod",
                    "bibbidi.ai.chatbot.memory-max-messages=10",
                    "bibbidi.ai.chatbot.conversation-idle-timeout=1h",
                    "bibbidi.ai.chatbot.qwen-model=qwen-test",
                    "bibbidi.ai.chatbot.sol-model=sol-test",
                    "bibbidi.ai.chatbot.luna-model=luna-test",
                    "bibbidi.ai.chatbot.luna-api-key=test-luna-key",
                    "spring.ai.bedrock.converse.chat.model=sol-test",
                    "spring.ai.bedrock.converse.chat.max-tokens=2048",
                    "spring.ai.bedrock.aws.region=ap-northeast-1");

    private final ApplicationContextRunner accountsEnabledRunner = runner.withPropertyValues(
            "bibbidi.ai.chatbot.accounts-enabled=true",
            "bibbidi.ai.chatbot.qwen-access-key=test-qwen-access-key",
            "bibbidi.ai.chatbot.qwen-secret-key=test-qwen-secret-key",
            "bibbidi.ai.chatbot.qwen-region=ap-northeast-1");

    @Test
    void keepsSolOnTheInstanceRoleEvenWhenGlobalBedrockKeysAreConfigured() {
        accountsEnabledRunner.withPropertyValues(
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
        accountsEnabledRunner.withPropertyValues("spring.profiles.active=dev")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasBean("qwenChatClient");
                    assertThat(context.getBean(AwsCredentialsProvider.class))
                            .isInstanceOf(InstanceProfileCredentialsProvider.class);
                });
    }

    @Test
    void rejectsAnEmptyQwenKeyInsteadOfUsingTheSolAccount() {
        accountsEnabledRunner.withPropertyValues("bibbidi.ai.chatbot.qwen-access-key=")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseMessage("Access key ID cannot be blank.");
                });
    }

    @Test
    void createsNoSeparateAccountClientsWhileAccountsAreDisabled() {
        runner.withPropertyValues("spring.profiles.active=dev")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).doesNotHaveBean("qwenChatClient");
                    assertThat(context).doesNotHaveBean("lunaChatClient");
                    assertThat(context).doesNotHaveBean("solBedrockCredentialsProvider");
                });
    }

    @Test
    void createsEverySeparateAccountClientOnceAccountsAreEnabled() {
        accountsEnabledRunner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasBean("qwenChatClient");
            assertThat(context).hasBean("lunaChatClient");
            assertThat(context).hasBean("solBedrockCredentialsProvider");
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"test", "evaluator", "loadtest"})
    void doesNotDependOnTheProfileToKeepAccountClientsOut(String profile) {
        runner.withPropertyValues(
                        "spring.profiles.active=" + profile,
                        "bibbidi.ai.chatbot.accounts-enabled=false")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).doesNotHaveBean("qwenChatClient");
                    assertThat(context).doesNotHaveBean("lunaChatClient");
                });
    }
}
