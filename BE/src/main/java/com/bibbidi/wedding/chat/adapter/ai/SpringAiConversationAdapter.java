package com.bibbidi.wedding.chat.adapter.ai;

import com.bibbidi.wedding.chat.service.dto.AiResponseStream;
import com.bibbidi.wedding.chat.service.dto.ChatPromptContext;
import com.bibbidi.wedding.chat.service.port.AiConversationPort;
import java.util.List;
import java.util.Map;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class SpringAiConversationAdapter implements AiConversationPort {

    private final ChatClient chatClient;
    private final BibbidiInMemoryChatMemory chatMemory;
    private final ObjectMapper mapper;

    public SpringAiConversationAdapter(ChatClient chatClient, BibbidiInMemoryChatMemory chatMemory, ObjectMapper mapper) {
        this.chatClient = chatClient;
        this.chatMemory = chatMemory;
        this.mapper = mapper;
    }

    @Override
    public AiResponseStream stream(String conversationKey, String message, ChatPromptContext context) {
        chatMemory.rememberContext(conversationKey, context);
        List<Message> memory = chatMemory.get(conversationKey);
        ChatPromptContext currentContext = chatMemory.getContext(conversationKey);
        Message checklist = new UserMessage(mapper.writeValueAsString(Map.of(
                "checklist", currentContext.checklist(), "recommendableItemIds", currentContext.recommendableItemIds())));
        Message catalog = new UserMessage(mapper.writeValueAsString(Map.of("catalog", currentContext.catalog())));
        return new AiResponseStream(chatClient.prompt()
                .messages(memory)
                .messages(checklist, catalog)
                .messages(new UserMessage(message))
                .stream()
                .content(), currentContext.recommendableItemIds());
    }

    @Override
    public void remember(String conversationKey, String message, String answer) {
        chatMemory.add(conversationKey, List.of(new UserMessage(message), new AssistantMessage(answer)));
    }

}
