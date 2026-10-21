package com.bibbidi.wedding.chat.adapter.ai.client;

import java.util.List;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

@Component
public class SpringAiChatClient {

    private final ChatClient chatClient;

    public SpringAiChatClient(ChatClient chatClient) {
        this.chatClient = chatClient;
    }

    public Flux<ChatResponse> stream(
            List<Message> memories,
            Message checklist,
            Message catalog,
            UserMessage userMessage
    ) {
        return chatClient.prompt()
                .messages(memories)
                .messages(checklist, catalog)
                .messages(userMessage)
                .stream()
                .chatResponse();
    }
}
