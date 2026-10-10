package com.bibbidi.wedding.chat.controller;

import com.bibbidi.wedding.chat.config.AiChatProperties;
import com.bibbidi.wedding.chat.controller.dto.req.ChatRequest;
import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.sse.service.SseService;
import com.bibbidi.wedding.sse.service.dto.SseEvent;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class AiChatController {

    private final AiChatService aiChatService;
    private final SseService sseService;
    private final AiChatProperties properties;

    public AiChatController(AiChatService aiChatService, SseService sseService, AiChatProperties properties) {
        this.aiChatService = aiChatService;
        this.sseService = sseService;
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
        SseEvent failure = new SseEvent("failure", new ChatResponse.Failure(ClientError.INTERNAL_ERROR.message()));
        return sseService.stream(properties.responseTimeout(), failure, connection ->
                aiChatService.chat(
                        userId,
                        request.conversationId(),
                        request.message(),
                        new ChatSseHandler(connection)
                )
        );
    }
}
