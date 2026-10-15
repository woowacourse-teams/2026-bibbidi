package com.bibbidi.wedding.chat.controller;

import com.bibbidi.wedding.chat.config.AiChatProperties;
import com.bibbidi.wedding.chat.controller.dto.req.ChatRequest;
import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.controller.sse.ChatSseHandler;
import com.bibbidi.wedding.chat.controller.sse.SseStreamManager;
import com.bibbidi.wedding.chat.controller.sse.dto.ChatEventType;
import com.bibbidi.wedding.chat.controller.sse.dto.SseEvent;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.validation.Valid;
import java.time.Duration;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class AiChatController {

    private final AiChatService aiChatService;
    private final SseStreamManager sseStreamManager;
    private final AiChatProperties properties;

    public AiChatController(AiChatService aiChatService, SseStreamManager sseStreamManager,
                            AiChatProperties properties) {
        this.aiChatService = aiChatService;
        this.sseStreamManager = sseStreamManager;
        this.properties = properties;
    }

    @PostMapping(
            value = "/api/ai/chat",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter chat(
            @AuthenticationPrincipal(expression = "userId") Long userId,
            @Valid @RequestBody ChatRequest request
    ) {
        SseEvent failure = new SseEvent(ChatEventType.FAILURE,
                new ChatResponse.Failure(ClientError.INTERNAL_ERROR.message()));
        return sseStreamManager.stream(
                Duration.ofSeconds(properties.responseTimeoutSeconds()),
                failure,
                connection -> {
                    ChatSseHandler handler = new ChatSseHandler(connection);
                    aiChatService.chat(userId, request.conversationId(), request.message())
                            .doOnNext(handler::send)
                            .blockLast();
                }
        );
    }
}
