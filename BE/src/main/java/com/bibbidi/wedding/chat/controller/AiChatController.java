package com.bibbidi.wedding.chat.controller;

import com.bibbidi.wedding.chat.controller.dto.req.ChatRequest;
import com.bibbidi.wedding.chat.controller.sse.ChatSseHandler;
import com.bibbidi.wedding.chat.controller.sse.SseConnection;
import com.bibbidi.wedding.chat.controller.sse.SseStreamManager;
import com.bibbidi.wedding.chat.controller.sse.config.SseProperties;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.service.dto.command.ChatCommand;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.chat.service.turn.CancelReason;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class AiChatController {

    private static final String UNSELECTED_MODEL = "unselected";

    private final AiChatService aiChatService;
    private final SseStreamManager sseStreamManager;
    private final SseProperties properties;
    private final MeterRegistry meterRegistry;

    public AiChatController(AiChatService aiChatService, SseStreamManager sseStreamManager,
                            SseProperties properties, MeterRegistry meterRegistry) {
        this.aiChatService = aiChatService;
        this.sseStreamManager = sseStreamManager;
        this.properties = properties;
        this.meterRegistry = meterRegistry;
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
        Timer.Sample ttftSample = Timer.start(meterRegistry);
        Duration timeout = Duration.ofSeconds(properties.responseTimeoutSeconds());
        ChatCommand chatCommand = new ChatCommand(userId, request.conversationId(), request.message());
        return sseStreamManager.stream(
                timeout,
                chatResponseConsumer(chatCommand, ttftSample)
        );
    }

    private static CancelReason cancelReasonOf(SseConnection connection) {
        return connection.timedOut() ? CancelReason.RESPONSE_TIMEOUT : CancelReason.CLIENT_DISCONNECTED;
    }

    private Consumer<SseConnection> chatResponseConsumer(ChatCommand chatCommand, Timer.Sample ttftSample) {
        return connection -> {
            ChatSseHandler handler = new ChatSseHandler(connection);
            AtomicBoolean firstDeltaSent = new AtomicBoolean();
            AtomicReference<String> model = new AtomicReference<>(UNSELECTED_MODEL);
            aiChatService.chat(chatCommand, () -> cancelReasonOf(connection))
                    .doOnNext(event -> {
                        if (event instanceof ChatResult.Selected selected) {
                            model.set(selected.tier().name());
                        }
                        if (handler.send(event) && firstDeltaSent.compareAndSet(false, true)) {
                            ttftSample.stop(meterRegistry.timer("ai.chat.ttft", "model", model.get()));
                        }
                    })
                    .blockLast();
        };
    }
}
