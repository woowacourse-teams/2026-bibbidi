package com.bibbidi.wedding.chat.controller.sse;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.controller.sse.dto.SseEvent;
import com.bibbidi.wedding.chat.service.dto.result.ChatEvent;
import com.bibbidi.wedding.chat.support.RecordingSseEmitter;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatSseHandlerTest {

    private RecordingSseEmitter emitter;
    private ChatSseHandler handler;

    @BeforeEach
    void setUp() {
        emitter = new RecordingSseEmitter();
        SseConnection connection = new SseConnection(emitter, new SseEvent(ChatEventType.FAILURE, "실패 안내"),
                System.nanoTime() + Duration.ofSeconds(30).toNanos());
        handler = new ChatSseHandler(connection);
    }

    @Test
    @DisplayName("대화 이벤트는 conversation 이벤트로 변환해 전송한다")
    void sendsConversationEvent() {
        // when
        handler.send(new ChatEvent.Conversation("대화 ID"));

        // then
        assertThat(sentEvent()).contains("event:conversation\ndata:", new ChatResponse.Conversation("대화 ID"));
    }

    @Test
    @DisplayName("답변 조각은 delta 이벤트로 변환해 전송한다")
    void sendsDeltaEvent() {
        // when
        handler.send(new ChatEvent.Delta("웨딩홀 "));

        // then
        assertThat(sentEvent()).contains("event:delta\ndata:", new ChatResponse.Delta("웨딩홀 "));
    }

    @Test
    @DisplayName("추천 카드는 component 이벤트로 변환해 전송한다")
    void sendsComponentEvent() {
        // when
        handler.send(new ChatEvent.Component(List.of(1L, 2L)));

        // then
        assertThat(sentEvent()).contains("event:component\ndata:", new ChatResponse.Component(List.of(1L, 2L)));
    }

    @Test
    @DisplayName("완료 이벤트는 done 이벤트로 변환해 대화 ID와 함께 전송한다")
    void sendsDoneEvent() {
        // when
        handler.send(new ChatEvent.Done("대화 ID"));

        // then
        assertThat(sentEvent()).contains("event:done\ndata:", new ChatResponse.Conversation("대화 ID"));
    }

    private List<Object> sentEvent() {
        assertThat(emitter.sentData()).hasSize(1);
        return emitter.sentData().getFirst();
    }
}
