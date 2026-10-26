package com.bibbidi.wedding.chat.support;

import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelRoute;
import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelRouter;
import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import java.util.Map;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.model.ChatModel;

public final class SpringAiChatClientFixture {

    private SpringAiChatClientFixture() {
    }

    public static SpringAiChatClient create(ChatModel model) {
        return create(model, MessageWindowChatMemory.builder().build());
    }

    public static SpringAiChatClient create(ChatModel model, ChatMemory memory) {
        ChatClient chatClient = ChatClient.builder(model)
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(memory).build())
                .build();
        return create(chatClient);
    }

    public static SpringAiChatClient create(ChatClient chatClient) {
        return new SpringAiChatClient(new ChatModelRouter(Map.of(
                ChatModelTier.QWEN, new ChatModelRoute(chatClient, "test-model", null))));
    }
}
