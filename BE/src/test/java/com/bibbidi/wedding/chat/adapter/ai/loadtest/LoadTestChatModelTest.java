package com.bibbidi.wedding.chat.adapter.ai.loadtest;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.adapter.ai.parser.ChatAnswerStream;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.prompt.Prompt;
import reactor.test.StepVerifier;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;
import tools.jackson.databind.json.JsonMapper;

class LoadTestChatModelTest {

    private static final Prompt PROMPT = new Prompt("안녕");

    @Test
    @DisplayName("설정한 토큰 수만큼 흘리고 끝난다")
    void emitsConfiguredNumberOfChunksThenCompletes() {
        LoadTestChatModel model = new LoadTestChatModel(
                new LoadTestChatModelProperties(1, 1, 3, 0), () -> 0.5);

        StepVerifier.create(model.stream(PROMPT))
                .expectNextCount(3)
                .expectComplete()
                .verify(Duration.ofSeconds(2));
    }

    @Test
    @DisplayName("서비스가 읽는 구조화된 응답으로 흘린다")
    void emitsStructuredAnswerTheServiceCanRead() {
        LoadTestChatModel model = new LoadTestChatModel(
                new LoadTestChatModelProperties(1, 1, 3, 0), () -> 0.5);
        List<String> chunks = model.stream(PROMPT)
                .map(response -> response.getResult().getOutput().getText())
                .collectList()
                .block(Duration.ofSeconds(2));

        var answer = new ChatAnswerStream(JsonMapper.builder().build()).read(chunks.stream(), delta -> { });

        assertThat(answer.answer()).isEqualTo("토큰0 토큰1 토큰2 ");
        assertThat(answer.recommendedItemIds()).isEmpty();
    }

    @Test
    @DisplayName("스로틀 비율에 걸리면 한도 초과 예외로 실패한다")
    void failsWithThrottlingExceptionWhenRatioHit() {
        LoadTestChatModel model = new LoadTestChatModel(
                new LoadTestChatModelProperties(1, 1, 3, 0.2), () -> 0.1);

        StepVerifier.create(model.stream(PROMPT))
                .expectError(ThrottlingException.class)
                .verify(Duration.ofSeconds(2));
    }

    @Test
    @DisplayName("스로틀 비율에 걸리지 않으면 정상 응답한다")
    void respondsNormallyWhenRatioNotHit() {
        LoadTestChatModel model = new LoadTestChatModel(
                new LoadTestChatModelProperties(1, 1, 2, 0.2), () -> 0.2);

        StepVerifier.create(model.stream(PROMPT))
                .expectNextCount(2)
                .expectComplete()
                .verify(Duration.ofSeconds(2));
    }
}
