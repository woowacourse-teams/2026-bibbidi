package com.bibbidi.wedding.chat.adapter.ai.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.chat.adapter.ai.config.AiChatProperties;
import com.bibbidi.wedding.chat.adapter.ai.config.AiChatConfig;
import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import com.bibbidi.wedding.chat.support.FakeChatModel;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.mock.env.MockEnvironment;
import reactor.core.publisher.Flux;

class SpringAiChatClientRoutingTest {

    @Test
    void sharesWriteSuccessStateWithToolContext() {
        ChatModelRequest request = new ChatModelRequest(7L, "conversation", new UserMessage("수정"));
        ChatClient chatClient = ChatClient.create(new FakeChatModel(prompt -> {
            Map<String, Object> context = ((ToolCallingChatOptions) prompt.getOptions()).getToolContext();
            ((AtomicBoolean) context.get("writeSucceeded")).set(true);
            return Flux.empty();
        }));
        SpringAiChatClient client = new SpringAiChatClient(new ChatModelRouter(Map.of(ChatModelTier.LOW,
                new ChatModelTarget(chatClient, "test-model", null))));

        client.streamReply(request, ChatModelTier.LOW).blockLast();

        assertThat(request.writeSucceeded()).isTrue();
    }

    @Test
    void routesEachTierThroughItsOwnAccountClient() {
        List<Prompt> solPrompts = new ArrayList<>();
        List<Prompt> qwenPrompts = new ArrayList<>();
        List<Prompt> lunaPrompts = new ArrayList<>();
        ChatClient sol = ChatClient.create(new FakeChatModel(prompt -> {
            solPrompts.add(prompt);
            return Flux.empty();
        }));
        ChatClient qwen = ChatClient.create(new FakeChatModel(prompt -> {
            qwenPrompts.add(prompt);
            return Flux.empty();
        }));
        StaticListableBeanFactory clients = new StaticListableBeanFactory();
        clients.addBean("qwen", qwen);
        ChatClient luna = ChatClient.create(new FakeChatModel(prompt -> {
            lunaPrompts.add(prompt);
            return Flux.empty();
        }));
        @SuppressWarnings("unchecked")
        ObjectProvider<ChatClient> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(luna);
        ChatModelRouter router = new AiChatConfig().chatModelRouter(
                sol, clients.getBeanProvider(ChatClient.class), provider,
                new AiChatProperties(10, Duration.ofHours(1),
                        "qwen-id", "global.openai.gpt-6.1-sol", "gpt-6-luna"), "", new MockEnvironment());
        SpringAiChatClient client = new SpringAiChatClient(router);

        client.streamReply(new ChatModelRequest(7L, "conversation", new UserMessage("인사")), ChatModelTier.LOW)
                .blockLast();
        client.streamReply(new ChatModelRequest(7L, "conversation", new UserMessage("비교")), ChatModelTier.HIGH)
                .blockLast();
        client.streamReply(new ChatModelRequest(7L, "conversation", new UserMessage("추천")), ChatModelTier.MEDIUM)
                .blockLast();

        assertThat(qwenPrompts).hasSize(1);
        assertThat(solPrompts).hasSize(1);
        assertThat(qwenPrompts.get(0).getOptions().getModel()).isEqualTo("qwen-id");
        assertThat(solPrompts.get(0).getOptions().getModel()).isEqualTo("global.openai.gpt-6.1-sol");
        assertThat(lunaPrompts).hasSize(1);
        assertThat(client.modelName(ChatModelTier.MEDIUM)).isEqualTo("gpt-6-luna");
    }

    @Test
    void routesEveryTierToBedrockQwenWithoutAccountClients() {
        List<Prompt> bedrockPrompts = new ArrayList<>();
        ChatClient bedrock = ChatClient.create(new FakeChatModel(prompt -> {
            bedrockPrompts.add(prompt);
            return Flux.empty();
        }));
        @SuppressWarnings("unchecked")
        ObjectProvider<ChatClient> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(null);
        ChatModelRouter router = new AiChatConfig().chatModelRouter(
                bedrock, new StaticListableBeanFactory()
                        .getBeanProvider(ChatClient.class), provider,
                new AiChatProperties(10, Duration.ofHours(1),
                        "qwen-id", "global.openai.gpt-6.1-sol", "gpt-6-luna"), "", new MockEnvironment());
        SpringAiChatClient client = new SpringAiChatClient(router);

        for (ChatModelTier tier : ChatModelTier.values()) {
            assertThat(client.modelName(tier)).isEqualTo("qwen-id");
            client.streamReply(new ChatModelRequest(7L, "conversation", new UserMessage("추천")), tier)
                    .blockLast();
        }
        assertThat(bedrockPrompts).hasSize(3)
                .allSatisfy(prompt -> assertThat(prompt.getOptions().getModel()).isEqualTo("qwen-id"));
    }

    @Test
    void routesEveryTierToTheAccountQwenClientInTheDevProfile() {
        List<Prompt> qwenPrompts = new ArrayList<>();
        ChatClient qwen = ChatClient.create(new FakeChatModel(prompt -> {
            qwenPrompts.add(prompt);
            return Flux.empty();
        }));
        ChatClient other = ChatClient.create(new FakeChatModel(prompt -> {
            throw new AssertionError("dev에서는 Qwen 외 클라이언트를 호출하면 안 됩니다.");
        }));
        StaticListableBeanFactory clients = new StaticListableBeanFactory();
        clients.addBean("qwenChatClient", qwen);
        @SuppressWarnings("unchecked")
        ObjectProvider<ChatClient> luna = mock(ObjectProvider.class);
        when(luna.getIfAvailable()).thenReturn(other);
        ChatModelRouter router = new AiChatConfig().chatModelRouter(
                other, clients.getBeanProvider(ChatClient.class), luna,
                new AiChatProperties(10, Duration.ofHours(1),
                        "qwen-id", "global.openai.gpt-6.1-sol", "gpt-6-luna"), "",
                new MockEnvironment().withProperty("spring.profiles.active", "dev"));
        SpringAiChatClient client = new SpringAiChatClient(router);

        for (ChatModelTier tier : ChatModelTier.values()) {
            assertThat(client.modelName(tier)).isEqualTo("qwen-id");
            client.streamReply(new ChatModelRequest(7L, "conversation", new UserMessage("추천")), tier)
                    .blockLast();
        }
        assertThat(qwenPrompts).hasSize(3);
    }

    @Test
    void routesEveryTierThroughTheEvaluationClientWhenAnEvaluationModelIsSet() {
        List<Prompt> evaluationPrompts = new ArrayList<>();
        ChatClient evaluation = ChatClient.create(new FakeChatModel(prompt -> {
            evaluationPrompts.add(prompt);
            return Flux.empty();
        }));
        StaticListableBeanFactory clients = new StaticListableBeanFactory();
        clients.addBean("unused", ChatClient.create(new FakeChatModel(prompt -> {
            throw new AssertionError("평가에서 계정별 클라이언트를 호출하면 안 됩니다.");
        })));
        ChatModelRouter router = new AiChatConfig().chatModelRouter(
                evaluation, clients.getBeanProvider(ChatClient.class), clients.getBeanProvider(ChatClient.class),
                new AiChatProperties(10, Duration.ofHours(1),
                        "qwen-id", "global.openai.gpt-6.1-sol", "gpt-6-luna"), "evaluation-model", new MockEnvironment());
        SpringAiChatClient client = new SpringAiChatClient(router);

        for (ChatModelTier tier : ChatModelTier.values()) {
            client.streamReply(new ChatModelRequest(7L, "conversation", new UserMessage("평가")), tier).blockLast();
            assertThat(client.modelName(tier)).isEqualTo("evaluation-model");
        }

        assertThat(evaluationPrompts).hasSize(3);
    }
}
