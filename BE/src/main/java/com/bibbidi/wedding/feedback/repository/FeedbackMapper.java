package com.bibbidi.wedding.feedback.repository;

import com.bibbidi.wedding.feedback.domain.Feedback;
import com.bibbidi.wedding.feedback.persistence.JpaFeedbackEntity;
import org.springframework.stereotype.Component;

@Component
public class FeedbackMapper {

    public JpaFeedbackEntity toEntity(Feedback feedback) {
        return new JpaFeedbackEntity(
                feedback.sentiment(),
                feedback.content()
        );
    }
}
