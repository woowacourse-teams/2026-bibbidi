package com.bibbidi.wedding.chat.controller.sse;

import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.controller.sse.dto.SseEvent;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;

public final class ChatSseHandler {

    private final SseConnection connection;
    private String conversationId;

    public ChatSseHandler(SseConnection connection) {
        this.connection = connection;
    }

    public boolean send(ChatResult result) {
        List<SseEvent> events = eventsOf(result);
        for (SseEvent event : events) {
            connection.send(event);
        }
        return events.stream().anyMatch(event -> event.type() == ChatEventType.DELTA);
    }

    private List<SseEvent> eventsOf(ChatResult result) {
        return switch (result) {
            case ChatResult.Conversation conversation -> {
                conversationId = conversation.conversationId();
                yield List.of(
                        new SseEvent(
                                ChatEventType.CONVERSATION,
                                new ChatResponse.Conversation(conversationId)
                        )
                );
            }
            case ChatResult.Delta delta -> List.of(
                    new SseEvent(
                            ChatEventType.DELTA,
                            new ChatResponse.Delta(delta.text())
                    )
            );
            case ChatResult.Answer answer -> {
                if (answer.recommendedItemIds().isEmpty()) {
                    yield List.of();
                }
                yield List.of(
                        new SseEvent(
                                ChatEventType.COMPONENT,
                                new ChatResponse.Component(answer.recommendedItemIds())
                        )
                );
            }
            case ChatResult.Refresh ignored -> List.of(
                    new SseEvent(
                            ChatEventType.REFRESH,
                            new ChatResponse.Refresh()
                    )
            );
            case ChatResult.Completed ignored -> List.of(
                    new SseEvent(
                            ChatEventType.DONE,
                            new ChatResponse.Conversation(conversationId)
                    )
            );
            case ChatResult.Failed failed ->
                    throw new BusinessException(ClientError.INTERNAL_ERROR,
                            "실패 사건은 서비스에서 오류로 전달해야 합니다.", failed.cause());
            case ChatResult.Selected ignored -> List.of();
            case ChatResult.Cancelled ignored -> List.of();
        };
    }
}
