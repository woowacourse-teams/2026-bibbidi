package com.bibbidi.wedding.feedback.repository;

import com.bibbidi.wedding.feedback.domain.Feedback;
import com.bibbidi.wedding.feedback.persistence.JpaFeedbackRepository;
import org.springframework.stereotype.Repository;

@Repository
public class FeedbackRepository {

    private final JpaFeedbackRepository jpaFeedbackRepository;
    private final FeedbackMapper feedbackMapper;

    public FeedbackRepository(JpaFeedbackRepository jpaFeedbackRepository, FeedbackMapper feedbackMapper) {
        this.jpaFeedbackRepository = jpaFeedbackRepository;
        this.feedbackMapper = feedbackMapper;
    }

    public void save(Feedback feedback) {
        jpaFeedbackRepository.save(feedbackMapper.toEntity(feedback));
    }
}
