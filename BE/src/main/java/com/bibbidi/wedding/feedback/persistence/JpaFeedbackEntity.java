package com.bibbidi.wedding.feedback.persistence;

import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import com.bibbidi.wedding.feedback.domain.Sentiment;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "feedbacks")
public class JpaFeedbackEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "sentiment", nullable = false, length = 20)
    private Sentiment sentiment;

    @Column(name = "content", length = 255)
    private String content;

    protected JpaFeedbackEntity() {
    }

    public JpaFeedbackEntity(Sentiment sentiment, String content) {
        this.sentiment = sentiment;
        this.content = content;
    }

    public Sentiment sentiment() {
        return sentiment;
    }

    public String content() {
        return content;
    }
}
