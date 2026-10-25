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
import reactor.core.publisher.Flux;

class SpringAiChatClientRoutingTest {

    @Test
    void routesSolAndQwenThroughBedrockClientAndLunaThroughOpenAiClient() {
        List<Prompt> bedrockPrompts = new ArrayList<>();
        List<Prompt> lunaPrompts = new ArrayList<>();
        ChatClient bedrock = ChatClient.create(new FakeChatModel(prompt -> {
            bedrockPrompts.add(prompt);
            return Flux.empty();
        }));
        ChatClient luna = ChatClient.create(new FakeChatModel(prompt -> {
            lunaPrompts.add(prompt);
            return Flux.empty();
        }));
        @SuppressWarnings("unchecked")
        ObjectProvider<ChatClient> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(luna);
        ChatModelRouter router = new AiChatConfig().chatModelRouter(
                bedrock, provider,
                new AiChatProperties(10, Duration.ofHours(1),
                        "qwen-id", "global.openai.gpt-6.1-sol", "gpt-6-luna"), "");
        SpringAiChatClient client = new SpringAiChatClient(router);

        client.streamReply(new ChatModelRequest(7L, "conversation", new UserMessage("인사"), ChatModelTier.QWEN))
                .blockLast();
        client.streamReply(new ChatModelRequest(7L, "conversation", new UserMessage("비교"), ChatModelTier.SOL))
                .blockLast();
        client.streamReply(new ChatModelRequest(7L, "conversation", new UserMessage("추천"), ChatModelTier.LUNA))
                .blockLast();

        assertThat(bedrockPrompts).hasSize(2);
        assertThat(bedrockPrompts.get(0).getOptions().getModel()).isEqualTo("qwen-id");
        assertThat(bedrockPrompts.get(1).getOptions().getModel()).isEqualTo("global.openai.gpt-6.1-sol");
        assertThat(lunaPrompts).hasSize(1);
        assertThat(client.modelName(ChatModelTier.LUNA)).isEqualTo("gpt-6-luna");
    }

    @Test
    void recordsTheBedrockSolModelForLunaWhenNoOpenAiClientExists() {
        ChatClient bedrock = ChatClient.create(new FakeChatModel(prompt -> Flux.empty()));
        @SuppressWarnings("unchecked")
        ObjectProvider<ChatClient> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(null);
        ChatModelRouter router = new AiChatConfig().chatModelRouter(
                bedrock, provider,
                new AiChatProperties(10, Duration.ofHours(1),
                        "qwen-id", "global.openai.gpt-6.1-sol", "gpt-6-luna"), "");
        SpringAiChatClient client = new SpringAiChatClient(router);

        assertThat(client.modelName(ChatModelTier.LUNA)).isEqualTo("global.openai.gpt-6.1-sol");
        assertThat(client.modelName(ChatModelTier.QWEN)).isEqualTo("qwen-id");
    }
}
