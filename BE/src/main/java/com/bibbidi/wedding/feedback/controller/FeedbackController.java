package com.bibbidi.wedding.feedback.controller;

import com.bibbidi.wedding.feedback.controller.dto.CreateFeedbackRequest;
import com.bibbidi.wedding.feedback.service.FeedbackService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FeedbackController {

    private final FeedbackService feedbackService;

    public FeedbackController(FeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/api/feedbacks")
    public void create(@Valid @RequestBody CreateFeedbackRequest request) {
        feedbackService.create(request);
    }
}
