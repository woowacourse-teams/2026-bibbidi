package com.bibbidi.wedding.chat.repository;

import com.bibbidi.wedding.chat.domain.ChatTurnRecord;
import com.bibbidi.wedding.chat.persistence.JpaChatTurnRepository;
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
}
