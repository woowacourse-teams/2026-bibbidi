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
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import reactor.core.publisher.Flux;

class SpringAiChatClientRoutingTest {

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
                        "qwen-id", "global.openai.gpt-6.1-sol", "gpt-6-luna"), "");
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
    void recordsTheBedrockSolModelForLunaWhenNoOpenAiClientExists() {
        ChatClient bedrock = ChatClient.create(new FakeChatModel(prompt -> Flux.empty()));
        @SuppressWarnings("unchecked")
        ObjectProvider<ChatClient> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(null);
        ChatModelRouter router = new AiChatConfig().chatModelRouter(
                bedrock, new StaticListableBeanFactory()
                        .getBeanProvider(ChatClient.class), provider,
                new AiChatProperties(10, Duration.ofHours(1),
                        "qwen-id", "global.openai.gpt-6.1-sol", "gpt-6-luna"), "");
        SpringAiChatClient client = new SpringAiChatClient(router);

        assertThat(client.modelName(ChatModelTier.MEDIUM)).isEqualTo("global.openai.gpt-6.1-sol");
        assertThat(client.modelName(ChatModelTier.LOW)).isEqualTo("qwen-id");
        client.streamReply(new ChatModelRequest(7L, "conversation", new UserMessage("추천")), ChatModelTier.MEDIUM)
                .blockLast();
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
                        "qwen-id", "global.openai.gpt-6.1-sol", "gpt-6-luna"), "evaluation-model");
        SpringAiChatClient client = new SpringAiChatClient(router);

        for (ChatModelTier tier : ChatModelTier.values()) {
            client.streamReply(new ChatModelRequest(7L, "conversation", new UserMessage("평가")), tier).blockLast();
            assertThat(client.modelName(tier)).isEqualTo("evaluation-model");
        }

        assertThat(evaluationPrompts).hasSize(3);
    }
}
