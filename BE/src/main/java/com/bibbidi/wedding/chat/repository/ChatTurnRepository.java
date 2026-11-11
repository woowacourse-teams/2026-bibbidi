package com.bibbidi.wedding.chat.repository;

import com.bibbidi.wedding.chat.domain.ChatTurnOutcome;
import com.bibbidi.wedding.chat.domain.ChatTurnRecord;
import com.bibbidi.wedding.chat.persistence.JpaChatTurnRepository;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class ChatTurnRepository {

    private final JpaChatTurnRepository jpaChatTurnRepository;
    private final ChatTurnMapper chatTurnMapper;

    public ChatTurnRepository(JpaChatTurnRepository jpaChatTurnRepository, ChatTurnMapper chatTurnMapper) {
        this.jpaChatTurnRepository = jpaChatTurnRepository;
        this.chatTurnMapper = chatTurnMapper;
    }

    public void save(ChatTurnRecord record) {
        jpaChatTurnRepository.save(chatTurnMapper.toEntity(record));
    }

    public List<ChatTurnRecord> findRecentCompleted(Long userId, UUID conversationId, int limit) {
        List<ChatTurnRecord> turns = new ArrayList<>(
                jpaChatTurnRepository.findByUserIdAndConversationIdAndOutcomeOrderByStartedAtDescIdDesc(
                                userId,
                                conversationId.toString(),
                                ChatTurnOutcome.COMPLETED,
                                PageRequest.of(0, limit)
                        ).stream()
                        .map(chatTurnMapper::toRecord)
                        .toList()
        );
        Collections.reverse(turns);
        return turns;
    }
}
