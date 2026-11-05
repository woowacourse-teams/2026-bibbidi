package com.bibbidi.wedding.chat.controller;

import com.bibbidi.wedding.chat.controller.dto.req.ChatRequest;
import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.controller.sse.ChatSseHandler;
import com.bibbidi.wedding.chat.controller.sse.ChatEventType;
import com.bibbidi.wedding.chat.controller.sse.SseConnection;
import com.bibbidi.wedding.chat.controller.sse.SseStreamManager;
import com.bibbidi.wedding.chat.controller.sse.config.SseProperties;
import com.bibbidi.wedding.chat.controller.sse.dto.SseEvent;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.service.dto.command.ChatCommand;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.function.Consumer;
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
    private final SseProperties properties;

    public AiChatController(AiChatService aiChatService, SseStreamManager sseStreamManager,
                            SseProperties properties) {
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
        Duration timeout = Duration.ofSeconds(properties.responseTimeoutSeconds());
        ChatCommand chatCommand = new ChatCommand(userId, request.conversationId(), request.message());
        return sseStreamManager.stream(
                timeout,
                failureEvent(),
                chatResponseConsumer(chatCommand)
        );
    }

    private Consumer<SseConnection> chatResponseConsumer(ChatCommand chatCommand) {
        return connection -> {
            ChatSseHandler handler = new ChatSseHandler(connection);
            aiChatService.chat(chatCommand)
                    .doOnNext(handler::send)
                    .blockLast();
        };
    }

    private SseEvent failureEvent() {
        return new SseEvent(
                ChatEventType.FAILURE,
                new ChatResponse.Failure(ClientError.INTERNAL_ERROR.message())
        );
    }
}
