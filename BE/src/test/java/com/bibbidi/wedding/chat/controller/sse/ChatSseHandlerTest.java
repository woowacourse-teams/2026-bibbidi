package com.bibbidi.wedding.chat.controller.sse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.chat.support.RecordingSseEmitter;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ChatSseHandlerTest {

    private RecordingSseEmitter emitter;
    private ChatSseHandler handler;

    @BeforeEach
    void setUp() {
        emitter = new RecordingSseEmitter();
        SseConnection connection = new SseConnection(emitter, System.nanoTime() + Duration.ofSeconds(30).toNanos());
        handler = new ChatSseHandler(connection);
    }

    @Test
    void sendsConversationEvent() {
        handler.send(new ChatResult.Conversation("대화 ID"));

        assertThat(sentEvent(0)).contains("event:conversation\ndata:",
                new ChatResponse.Conversation("대화 ID"));
    }

    @Test
    void sendsDeltaEvent() {
        assertThat(handler.send(new ChatResult.Delta("웨딩홀 "))).isTrue();

        assertThat(sentEvent(0)).contains("event:delta\ndata:", new ChatResponse.Delta("웨딩홀 "));
    }

    @Test
    void sendsComponentBeforeDone() {
        handler.send(new ChatResult.Conversation("대화 ID"));
        handler.send(new ChatResult.Answer("답변", List.of(1L, 2L)));
        handler.send(new ChatResult.Completed());

        assertThat(sentEvent(1)).contains("event:component\ndata:",
                new ChatResponse.Component(List.of(1L, 2L)));
        assertThat(sentEvent(2)).contains("event:done\ndata:",
                new ChatResponse.Conversation("대화 ID"));
    }

    @Test
    void sendsDoneWithoutComponent() {
        handler.send(new ChatResult.Conversation("대화 ID"));
        handler.send(new ChatResult.Answer("답변", List.of()));
        handler.send(new ChatResult.Completed());

        assertThat(sentEvent(1)).contains("event:done\ndata:",
                new ChatResponse.Conversation("대화 ID"));
        assertThat(emitter.sentData()).hasSize(2);
    }

    @Test
    void sendsRefreshBeforeDone() {
        handler.send(new ChatResult.Conversation("대화 ID"));
        handler.send(new ChatResult.Refresh());
        handler.send(new ChatResult.Completed());

        assertThat(sentEvent(1)).contains("event:refresh\ndata:", new ChatResponse.Refresh());
        assertThat(sentEvent(2)).contains("event:done\ndata:",
                new ChatResponse.Conversation("대화 ID"));
    }

    @Test
    void mapsUnexpectedFailedResultToServiceError() {
        IllegalStateException cause = new IllegalStateException("모델 오류");

        assertThatThrownBy(() -> handler.send(new ChatResult.Failed(cause)))
                .isInstanceOfSatisfying(BusinessException.class, error -> {
                    assertThat(error.clientError()).isEqualTo(ClientError.INTERNAL_ERROR);
                    assertThat(error.getCause()).isSameAs(cause);
                });
    }

    private List<Object> sentEvent(int index) {
        return emitter.sentData().get(index);
    }
}
