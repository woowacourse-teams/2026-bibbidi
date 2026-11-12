package com.bibbidi.wedding.chat.persistence;

import com.bibbidi.wedding.chat.domain.ChatTurnOutcome;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaChatTurnRepository extends JpaRepository<JpaChatTurnEntity, Long> {

    List<JpaChatTurnEntity> findByUserIdAndConversationIdAndOutcomeOrderByStartedAtDescIdDesc(
            Long userId,
            String conversationId,
            ChatTurnOutcome outcome,
            Pageable pageable
    );
}
