package com.bibbidi.wedding.feedback.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verifyNoInteractions;

import com.bibbidi.wedding.feedback.controller.dto.CreateFeedbackRequest;
import com.bibbidi.wedding.feedback.domain.Feedback;
import com.bibbidi.wedding.feedback.event.FeedbackCreatedEvent;
import com.bibbidi.wedding.feedback.repository.FeedbackRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class FeedbackServiceTest {

    @Mock
    private FeedbackRepository feedbackRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private FeedbackService feedbackService;

    @Test
    @DisplayName("피드백을 저장한 후 생성 이벤트를 발행한다")
    void shouldSaveFeedbackAndPublishCreatedEvent() {
        CreateFeedbackRequest request = new CreateFeedbackRequest("good", "feedback");

        feedbackService.create(request);

        InOrder inOrder = inOrder(feedbackRepository, eventPublisher);
        inOrder.verify(feedbackRepository).save(any(Feedback.class));
        inOrder.verify(eventPublisher).publishEvent(any(FeedbackCreatedEvent.class));
    }

    @Test
    @DisplayName("지원하지 않는 sentiment는 저장하지 않는다")
    void shouldRejectUnsupportedSentiment() {
        CreateFeedbackRequest request = new CreateFeedbackRequest("unknown", null);

        assertThatThrownBy(() -> feedbackService.create(request))
                .isInstanceOf(RuntimeException.class);

        verifyNoInteractions(feedbackRepository, eventPublisher);
    }
}
