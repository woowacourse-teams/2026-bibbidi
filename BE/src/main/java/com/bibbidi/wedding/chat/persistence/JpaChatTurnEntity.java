package com.bibbidi.wedding.chat.persistence;

import com.bibbidi.wedding.chat.domain.ChatTurnOutcome;
import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.jspecify.annotations.Nullable;

@Entity
@Table(name = "chat_turns")
public class JpaChatTurnEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "conversation_id", nullable = false, length = 36)
    private String conversationId;

    @Column(name = "user_prompt", nullable = false, columnDefinition = "TEXT")
    private String userPrompt;

    @Column(name = "completion", nullable = false, columnDefinition = "TEXT")
    private String completion;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome", nullable = false, length = 20)
    private ChatTurnOutcome outcome;

    @Column(name = "outcome_reason", length = 30)
    private String outcomeReason;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    protected JpaChatTurnEntity() {
    }

    public JpaChatTurnEntity(
            Long userId,
            String conversationId,
            String userPrompt,
            String completion,
            ChatTurnOutcome outcome,
            @Nullable String outcomeReason,
            LocalDateTime startedAt
    ) {
        this.userId = userId;
        this.conversationId = conversationId;
        this.userPrompt = userPrompt;
        this.completion = completion;
        this.outcome = outcome;
        this.outcomeReason = outcomeReason;
        this.startedAt = startedAt;
    }

    public Long userId() {
        return userId;
    }

    public String conversationId() {
        return conversationId;
    }

    public String userPrompt() {
        return userPrompt;
    }

    public String completion() {
        return completion;
    }

    public ChatTurnOutcome outcome() {
        return outcome;
    }

    public @Nullable String outcomeReason() {
        return outcomeReason;
    }

    public LocalDateTime startedAt() {
        return startedAt;
    }
}
