package com.bibbidi.wedding.chat.adapter.ai.client;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

@Component
public class SpringAiChatClient {

    private final ChatClient chatClient;

    @Autowired
    public SpringAiChatClient(ChatClient chatClient) {
        this.chatClient = chatClient;
    }

    public Flux<ChatResponse> streamReply(String conversationKey, UserMessage userMessage) {
        return chatClient.prompt()
                .messages(userMessage)
                .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, conversationKey))
                .stream()
                .chatResponse();
    }
}
