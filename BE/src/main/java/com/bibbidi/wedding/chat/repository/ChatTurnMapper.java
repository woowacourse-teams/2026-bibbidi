package com.bibbidi.wedding.chat.repository;

import com.bibbidi.wedding.chat.domain.ChatTurnRecord;
import com.bibbidi.wedding.chat.persistence.JpaChatTurnEntity;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class ChatTurnMapper {

    public JpaChatTurnEntity toEntity(ChatTurnRecord record) {
        return new JpaChatTurnEntity(
                record.userId(),
                record.conversationId().toString(),
                record.userPrompt(),
                record.completion(),
                record.model(),
                record.outcome(),
                record.outcomeReason(),
                record.startedAt(),
                record.durationMs()
        );
    }

    public ChatTurnRecord toRecord(JpaChatTurnEntity entity) {
        return new ChatTurnRecord(
                entity.userId(),
                UUID.fromString(entity.conversationId()),
                entity.userPrompt(),
                entity.completion(),
                entity.model(),
                entity.outcome(),
                entity.outcomeReason(),
                entity.startedAt(),
                entity.durationMs()
        );
    }
}
