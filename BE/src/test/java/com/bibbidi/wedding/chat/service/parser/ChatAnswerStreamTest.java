package com.bibbidi.wedding.chat.service.parser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import com.bibbidi.wedding.common.exception.BusinessException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CancellationException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import tools.jackson.databind.json.JsonMapper;

class ChatAnswerStreamTest {

    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    @DisplayName("JSON 필드와 이스케이프가 조각 경계에서 나뉘어도 답변만 즉시 전달한다")
    void streamsOnlyTheDecodedAnswerAcrossEveryPossibleChunkBoundary() {
        // given
        String json = "{\"answer\":\"준비 \\\"목록\\\"\\n경로 \\\\ / \\uD83D\\uDE00\",\"recommendedItemIds\":[2,1]}";
        String expected = "준비 \"목록\"\n경로 \\ / 😀";

        for (int boundary = 0; boundary <= json.length(); boundary++) {
            ChatAnswerStream stream = new ChatAnswerStream(mapper);
            List<String> deltas = new ArrayList<>();

            // when
            ChatAnswer answer = stream.read(Stream.of(json.substring(0, boundary), json.substring(boundary)), deltas::add);

            // then
            assertThat(String.join("", deltas)).isEqualTo(expected);
            assertThat(answer).isEqualTo(new ChatAnswer(expected, List.of(2L, 1L)));
            assertThat(deltas).allSatisfy(delta ->
                    assertThat(Character.isHighSurrogate(delta.charAt(delta.length() - 1))).isFalse());
        }
    }

    @Test
    @DisplayName("답변 필드가 끝나기 전에도 텍스트를 전달하고 추천 ID는 노출하지 않는다")
    void streamsBeforeTheAnswerStringIsCompleteAndAcceptsEitherFieldOrder() {
        // given
        ChatAnswerStream stream = new ChatAnswerStream(mapper);
        List<String> deltas = new ArrayList<>();
        String remaining = "답변\"}";
        Stream<String> chunks = Stream.of("", "{\"recommendedItemIds\":[2],\"answer\":\"일부 ", "", remaining, "")
                .peek(chunk -> {
                    if (chunk.equals(remaining)) {
                        assertThat(deltas).containsExactly("일부 ");
                    }
                });

        // when, then
        assertThat(stream.read(chunks, deltas::add)).isEqualTo(new ChatAnswer("일부 답변", List.of(2L)));
        assertThat(deltas).containsExactly("일부 ", "답변");
    }

    @ParameterizedTest
    @MethodSource("singleCharacterOutputs")
    @DisplayName("한 글자씩 수신해도 JSON처럼 보이는 답변과 이모지를 원문대로 전달한다")
    void streamsSingleCharacterChunksWithoutSplittingEmoji(String json, String expected) {
        ChatAnswerStream stream = new ChatAnswerStream(mapper);
        List<String> deltas = new ArrayList<>();
        Stream<String> chunks = json.chars().mapToObj(character -> String.valueOf((char) character));
        ChatAnswer answer = stream.read(chunks, delta -> {
            assertThat(Character.isHighSurrogate(delta.charAt(delta.length() - 1))).isFalse();
            deltas.add(delta);
        });
        assertThat(String.join("", deltas)).isEqualTo(expected);
        assertThat(answer).isEqualTo(new ChatAnswer(expected, List.of(2L)));
    }

    @Test
    @DisplayName("입력과 출력 버퍼보다 큰 답변도 조각별로 전송하고 원문을 유지한다")
    void streamsAnswersLargerThanTheParserBuffers() {
        String expected = "준비 \\\"목록\\\"\n😀 ".repeat(3000);
        String json = mapper.writeValueAsString(new ChatAnswer(expected, List.of(2L)));
        List<String> deltas = new ArrayList<>();
        AtomicBoolean closed = new AtomicBoolean();

        ChatAnswer answer = new ChatAnswerStream(mapper).read(
                Stream.of(json).onClose(() -> closed.set(true)), deltas::add);

        assertThat(answer).isEqualTo(new ChatAnswer(expected, List.of(2L)));
        assertThat(deltas.size()).isGreaterThan(1);
        assertThat(String.join("", deltas)).isEqualTo(expected);
        assertThat(deltas).allSatisfy(delta ->
                assertThat(Character.isHighSurrogate(delta.charAt(delta.length() - 1))).isFalse());
        assertThat(closed).isTrue();
    }

    @Test
    @DisplayName("답변 전송이 취소되면 원래 예외를 유지하고 모델 스트림을 닫는다")
    void closesTheModelStreamWhenAnswerDeliveryIsCancelled() {
        AtomicBoolean closed = new AtomicBoolean();
        CancellationException cancelled = new CancellationException("연결이 종료되었습니다.");
        Stream<String> chunks = Stream.of("{\"answer\":\"일부 ", "답변\",\"recommendedItemIds\":[]}")
                .onClose(() -> closed.set(true));

        assertThatThrownBy(() -> new ChatAnswerStream(mapper).read(chunks, delta -> {
            throw cancelled;
        })).isSameAs(cancelled);
        assertThat(closed).isTrue();
    }

    static Stream<Arguments> singleCharacterOutputs() {
        String literalAnswer = "제목 {\"answer\":\"가짜\"}를 확인 😀";
        return Stream.of(
                Arguments.of(JsonMapper.builder().build().writeValueAsString(new ChatAnswer(literalAnswer, List.of(2L))),
                        literalAnswer),
                Arguments.of("{\"recommendedItemIds\":[2],\"ans\\u0077er\":\"준비\\n\\uD83D\\uDE00\"}", "준비\n😀")
        );
    }

    @ParameterizedTest
    @MethodSource("invalidOutputs")
    @DisplayName("불완전하거나 계약에 맞지 않는 출력은 완료 결과로 인정하지 않는다")
    void rejectsMalformedOrInvalidOutputs(String json) {
        // given
        ChatAnswerStream stream = new ChatAnswerStream(mapper);
        AtomicBoolean closed = new AtomicBoolean();

        // when, then
        assertThatThrownBy(() -> stream.read(Stream.of(json).onClose(() -> closed.set(true)), delta -> { }))
                .isInstanceOf(BusinessException.class)
                .hasMessage("챗봇의 구조화된 응답이 올바르지 않습니다.");
        assertThat(closed).isTrue();
    }

    static Stream<String> invalidOutputs() {
        return Stream.of(
                "",
                "[]",
                "null",
                "{\"answer\":\"일부",
                "{\"answer\":42,\"recommendedItemIds\":[]}",
                "{\"answer\":\" \",\"recommendedItemIds\":[]}",
                "{\"answer\":\"답변\"}",
                "{\"recommendedItemIds\":[]}",
                "{\"answer\":\"답변\",\"recommendedItemIds\":null}",
                "{\"answer\":\"답변\",\"recommendedItemIds\":{}}",
                "{\"answer\":\"답변\",\"recommendedItemIds\":[\"1\"]}",
                "{\"answer\":\"답변\",\"recommendedItemIds\":[1.5]}",
                "{\"answer\":\"답변\",\"recommendedItemIds\":[0]}",
                "{\"answer\":\"답변\",\"recommendedItemIds\":[9223372036854775808]}",
                "{\"answer\":\"답변\",\"recommendedItemIds\":[],\"extra\":true}",
                "{\"answer\":\"답변\",\"answer\":\"다른 답변\",\"recommendedItemIds\":[]}",
                "{\"answer\":\"답변\",\"recommendedItemIds\":[],\"recommendedItemIds\":[]}",
                "{\"answer\":\"답변\",\"recommendedItemIds\":[],\"recommendedItem\\u0049ds\":[]}",
                "{\"answer\":\"\\q\",\"recommendedItemIds\":[]}",
                "{\"answer\":\"\\uZZZZ\",\"recommendedItemIds\":[]}",
                "{\"answer\":\"\\uD83D\",\"recommendedItemIds\":[]}",
                "{\"answer\":\"답변\",\"recommendedItemIds\":[]}{}"
        );
    }
}
