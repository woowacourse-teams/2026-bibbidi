package com.bibbidi.wedding.feedback.service;

import com.bibbidi.wedding.feedback.controller.dto.CreateFeedbackRequest;
import com.bibbidi.wedding.feedback.domain.Sentiment;
import com.bibbidi.wedding.feedback.domain.Feedback;
import com.bibbidi.wedding.feedback.event.FeedbackCreatedEvent;
import com.bibbidi.wedding.feedback.repository.FeedbackRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;
    private final ApplicationEventPublisher eventPublisher;

    public FeedbackService(
            FeedbackRepository feedbackRepository,
            ApplicationEventPublisher eventPublisher
    ) {
        this.feedbackRepository = feedbackRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public void create(CreateFeedbackRequest request) {
        Sentiment sentiment = Sentiment.from(request.sentiment());
        Feedback feedback = new Feedback(sentiment, request.content());
        feedbackRepository.save(feedback);
        eventPublisher.publishEvent(new FeedbackCreatedEvent(feedback));
    }
}
