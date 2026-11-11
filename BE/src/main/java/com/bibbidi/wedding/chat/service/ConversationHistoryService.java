package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.domain.ChatTurnRecord;
import com.bibbidi.wedding.chat.repository.ChatTurnRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ConversationHistoryService {

    private final ChatTurnRepository chatTurnRepository;

    public ConversationHistoryService(ChatTurnRepository chatTurnRepository) {
        this.chatTurnRepository = chatTurnRepository;
    }

    @Transactional(readOnly = true)
    public List<ChatTurnRecord> findRecentCompletedTurns(ConversationKey key, int limit) {
        return chatTurnRepository.findRecentCompleted(key.userId(), key.conversationId(), limit);
    }
}
