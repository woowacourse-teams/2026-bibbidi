package com.bibbidi.wedding.chat.adapter.ai.memory;

import com.bibbidi.wedding.chat.adapter.ai.config.AiChatProperties;
import com.bibbidi.wedding.chat.domain.ChatTurnRecord;
import com.bibbidi.wedding.chat.service.ConversationHistoryService;
import com.bibbidi.wedding.chat.service.ConversationKey;
import java.util.ArrayList;
import java.util.List;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Component;

@Component
public class StoredConversationRestorer {

    private static final int MESSAGES_PER_TURN = 2;

    private final ChatMemory chatMemory;
    private final ConversationHistoryService historyService;
    private final int turnLimit;

    public StoredConversationRestorer(
            ChatMemory chatMemory,
            ConversationHistoryService historyService,
            AiChatProperties properties
    ) {
        this.chatMemory = chatMemory;
        this.historyService = historyService;
        this.turnLimit = properties.memoryMaxMessages() / MESSAGES_PER_TURN;
    }

    public void restoreIfNoCompletedTurn(String conversationKey) {
        if (hasCompletedExchange(chatMemory.get(conversationKey))) {
            return;
        }
        List<ChatTurnRecord> turns = historyService.findRecentCompletedTurns(
                ConversationKey.fromMemoryKey(conversationKey), turnLimit);
        if (turns.isEmpty()) {
            return;
        }
        List<Message> messages = new ArrayList<>();
        for (ChatTurnRecord turn : turns) {
            messages.add(new UserMessage(turn.userPrompt()));
            messages.add(new AssistantMessage(turn.completion()));
        }
        chatMemory.clear(conversationKey);
        chatMemory.add(conversationKey, messages);
    }

    private boolean hasCompletedExchange(List<Message> messages) {
        return messages.stream().anyMatch(message -> message.getMessageType() == MessageType.ASSISTANT);
    }
}
