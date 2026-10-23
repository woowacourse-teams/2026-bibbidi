package com.bibbidi.wedding.chat.evaluation.report;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.evaluation.data.result.ModelTokenUsage;
import com.bibbidi.wedding.chat.support.FakeChatModel;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

class RecordingChatModelTest {

    @Test
    @DisplayName("토큰 메타데이터가 없는 마지막 조각 이후에도 누적 사용량을 한 번만 기록한다")
    void keepsTheLastReportedUsageWithoutAddingCumulativeChunks() {
        FakeChatModel delegate = new FakeChatModel(Flux.just(
                chunk("first", 10, 3), chunk("second", 10, 5),
                new ChatResponse(List.of(new Generation(new AssistantMessage("last"))))));
        RecordingChatModel model = new RecordingChatModel(delegate);
        model.stream(new Prompt("question")).blockLast();
        assertThat(model.calls()).singleElement().satisfies(call -> {
            assertThat(call.response().getResult().getOutput().getText()).isEqualTo("firstsecondlast");
            ModelTokenUsage usage = ModelTokenUsage.fromSpring(call.response().getMetadata().getUsage());
            assertThat(usage.inputTokens()).isEqualTo(10);
            assertThat(usage.outputTokens()).isEqualTo(5);
            assertThat(usage.totalTokens()).isEqualTo(15);
        });
    }

    @Test
    @DisplayName("스트리밍을 취소해도 수신한 답변과 사용량을 한 번 기록한다")
    void recordsReceivedContentOnceOnCancellation() {
        FakeChatModel delegate = new FakeChatModel(
                Flux.concat(Flux.just(chunk("partial", 10, 3)), Flux.never()));
        RecordingChatModel model = new RecordingChatModel(delegate);
        StepVerifier.create(model.stream(new Prompt("question")))
                .expectNextCount(1).thenCancel().verify();
        assertThat(model.calls()).singleElement().satisfies(call ->
                assertThat(call.response().getResult().getOutput().getText()).isEqualTo("partial"));
    }

    @Test
    @DisplayName("제공되지 않은 토큰 사용량은 0으로 바꾸지 않고 미확인 값으로 남긴다")
    void leavesUnreportedTokenUsageUnknown() {
        FakeChatModel delegate = new FakeChatModel(Flux.just(
                new ChatResponse(List.of(new Generation(new AssistantMessage("answer"))))));
        RecordingChatModel model = new RecordingChatModel(delegate);
        model.stream(new Prompt("question")).blockLast();
        var usage = ModelTokenUsage.fromSpring(model.calls().getFirst().response().getMetadata().getUsage());
        assertThat(usage.inputTokens()).isNull();
        assertThat(usage.outputTokens()).isNull();
        assertThat(usage.totalTokens()).isNull();
    }

    private ChatResponse chunk(String text, int input, int output) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))),
                ChatResponseMetadata.builder().usage(new DefaultUsage(input, output)).build());
    }
}
