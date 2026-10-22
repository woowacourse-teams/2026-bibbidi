package com.bibbidi.wedding.chat.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.domain.ChatTurnOutcome;
import com.bibbidi.wedding.chat.domain.ChatTurnRecord;
import com.bibbidi.wedding.chat.persistence.JpaChatTurnEntity;
import com.bibbidi.wedding.chat.persistence.JpaChatTurnRepository;
import com.bibbidi.wedding.support.TestDatabaseLocks;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
@Import({ChatTurnRepository.class, ChatTurnMapper.class})
@ResourceLock(TestDatabaseLocks.SPRING_TEST)
class ChatTurnRepositoryTest {

    private static final UUID CONVERSATION_ID = UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea99");
    private static final LocalDateTime STARTED_AT = LocalDateTime.of(2026, 10, 22, 9, 0, 1);

    @Autowired
    private ChatTurnRepository chatTurnRepository;

    @Autowired
    private JpaChatTurnRepository jpaChatTurnRepository;

    @Test
    @DisplayName("취소된 턴을 사유와 함께 저장한다")
    void savesACancelledTurn() {
        // when
        chatTurnRepository.save(new ChatTurnRecord(
                7L, CONVERSATION_ID, "질문", "일부 출력", ChatTurnOutcome.CANCELLED, "RESPONSE_TIMEOUT", STARTED_AT));

        // then
        List<JpaChatTurnEntity> saved = jpaChatTurnRepository.findAll();
        assertThat(saved).hasSize(1);
        JpaChatTurnEntity turn = saved.getFirst();
        assertThat(turn.userId()).isEqualTo(7L);
        assertThat(turn.conversationId()).isEqualTo(CONVERSATION_ID.toString());
        assertThat(turn.userPrompt()).isEqualTo("질문");
        assertThat(turn.completion()).isEqualTo("일부 출력");
        assertThat(turn.outcome()).isEqualTo(ChatTurnOutcome.CANCELLED);
        assertThat(turn.outcomeReason()).isEqualTo("RESPONSE_TIMEOUT");
        assertThat(turn.startedAt()).isEqualTo(STARTED_AT);
        assertThat(turn.createdAt()).isNotNull();
    }

    @Test
    @DisplayName("완료한 턴은 사유 없이 저장하고 긴 출력과 빈 출력도 저장한다")
    void savesACompletedTurnWithoutReasonAndLongOrEmptyCompletion() {
        // given
        String longCompletion = "웨딩홀 계약 ".repeat(3000);

        // when
        chatTurnRepository.save(new ChatTurnRecord(
                7L, CONVERSATION_ID, "질문", longCompletion, ChatTurnOutcome.COMPLETED, null, STARTED_AT));
        chatTurnRepository.save(new ChatTurnRecord(
                7L, CONVERSATION_ID, "다음 질문", "", ChatTurnOutcome.CANCELLED, "CLIENT_DISCONNECTED", STARTED_AT));

        // then
        List<JpaChatTurnEntity> saved = jpaChatTurnRepository.findAll();
        assertThat(saved).hasSize(2);
        assertThat(saved.getFirst().completion()).isEqualTo(longCompletion);
        assertThat(saved.getFirst().outcomeReason()).isNull();
        assertThat(saved.getLast().completion()).isEmpty();
    }
}
