package com.bibbidi.wedding.chat.repository;

import com.bibbidi.wedding.chat.domain.ChatTurnRecord;
import com.bibbidi.wedding.chat.persistence.JpaChatTurnEntity;
import org.springframework.stereotype.Component;

@Component
public class ChatTurnMapper {

    public JpaChatTurnEntity toEntity(ChatTurnRecord record) {
        return new JpaChatTurnEntity(
                record.userId(),
                record.conversationId().toString(),
                record.userPrompt(),
                record.completion(),
                record.outcome(),
                record.outcomeReason(),
                record.startedAt()
        );
    }
}
