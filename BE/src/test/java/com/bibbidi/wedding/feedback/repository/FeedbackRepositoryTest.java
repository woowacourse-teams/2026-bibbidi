package com.bibbidi.wedding.feedback.repository;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.feedback.domain.Feedback;
import com.bibbidi.wedding.feedback.domain.Sentiment;
import com.bibbidi.wedding.feedback.persistence.JpaFeedbackEntity;
import com.bibbidi.wedding.feedback.persistence.JpaFeedbackRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FeedbackRepositoryTest {

    private final JpaFeedbackRepository jpaFeedbackRepository = mock(JpaFeedbackRepository.class);
    private final FeedbackMapper feedbackMapper = mock(FeedbackMapper.class);
    private final FeedbackRepository feedbackRepository = new FeedbackRepository(
            jpaFeedbackRepository,
            feedbackMapper
    );

    @Test
    @DisplayName("피드백을 엔티티로 변환해 JPA 리포지토리에 저장한다")
    void shouldMapAndSaveFeedback() {
        Feedback feedback = new Feedback(Sentiment.GOOD, "feedback");
        JpaFeedbackEntity entity = mock(JpaFeedbackEntity.class);
        when(feedbackMapper.toEntity(feedback)).thenReturn(entity);

        feedbackRepository.save(feedback);

        verify(feedbackMapper).toEntity(feedback);
        verify(jpaFeedbackRepository).save(entity);
    }
}
