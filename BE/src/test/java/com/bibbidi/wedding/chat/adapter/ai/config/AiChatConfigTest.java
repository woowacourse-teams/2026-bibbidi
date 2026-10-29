package com.bibbidi.wedding.chat.adapter.ai.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.any;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.chat.adapter.ai.prompt.SystemPrompt;
import com.bibbidi.wedding.chat.adapter.ai.tools.AppointmentServiceAdapter;
import com.bibbidi.wedding.chat.adapter.ai.tools.CatalogServiceAdapter;
import com.bibbidi.wedding.chat.adapter.ai.tools.ChecklistServiceAdapter;
import io.micrometer.observation.ObservationRegistry;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ChatClientRequest;
import org.springframework.ai.chat.client.ChatClientResponse;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisor;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisorChain;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.bedrock.autoconfigure.BedrockAwsConnectionConfiguration;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.Ordered;
import reactor.core.publisher.Flux;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.InstanceProfileCredentialsProvider;

class AiChatConfigTest {

    private final ToolCallingManager toolCallingManager = spy(ToolCallingManager.builder().build());

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(AiChatConfig.class)
            .withConfiguration(AutoConfigurations.of(BedrockAwsConnectionConfiguration.class))
            .withBean(ChatClient.Builder.class, () -> ChatClient.builder(mock(ChatModel.class)))
            .withBean(ObservationRegistry.class, ObservationRegistry::create)
            .withBean(ToolCallingManager.class, () -> toolCallingManager)
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

    @Test
    void qwenUsesTheConfiguredToolCallingManagerThroughItsAdvisor() {
        AtomicInteger modelCalls = new AtomicInteger();
        StreamAdvisor model = new StreamAdvisor() {
            @Override
            public Flux<ChatClientResponse> adviseStream(ChatClientRequest request, StreamAdvisorChain chain) {
                AssistantMessage message = modelCalls.getAndIncrement() == 0
                        ? AssistantMessage.builder().content("").toolCalls(List.of(new AssistantMessage.ToolCall(
                                "read-1", "function", "getMyChecklist", "{}"))).build()
                        : new AssistantMessage("답변");
                return Flux.just(ChatClientResponse.builder()
                        .chatResponse(new ChatResponse(List.of(new Generation(message))))
                        .context(request.context()).build());
            }

            @Override
            public String getName() {
                return "Test model";
            }

            @Override
            public int getOrder() {
                return Ordered.LOWEST_PRECEDENCE - 1;
            }
        };
        accountsEnabledRunner.run(context -> {
            assertThat(context).hasNotFailed();
            context.getBean("qwenChatClient", ChatClient.class).prompt().user("체크리스트 조회")
                    .toolContext(Map.of("userId", 7L))
                    .advisors(spec -> spec.param(ChatMemory.CONVERSATION_ID, "qwen-test"))
                    .advisors(model).stream().chatResponse().blockLast();

            assertThat(modelCalls).hasValue(2);
            verify(toolCallingManager).executeToolCalls(any(Prompt.class), any(ChatResponse.class));
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
