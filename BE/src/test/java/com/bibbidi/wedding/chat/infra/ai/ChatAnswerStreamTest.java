package com.bibbidi.wedding.chat.infra.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import com.bibbidi.wedding.common.exception.BusinessException;
import java.util.List;
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

            // when
            String first = stream.append(json.substring(0, boundary));
            String second = stream.append(json.substring(boundary));

            // then
            assertThat(first + second).isEqualTo(expected);
            assertThat(stream.finish()).isEqualTo(new ChatAnswer(expected, List.of(2L, 1L)));
            if (!first.isEmpty()) {
                assertThat(Character.isHighSurrogate(first.charAt(first.length() - 1))).isFalse();
            }
        }
    }

    @Test
    @DisplayName("답변 필드가 끝나기 전에도 텍스트를 전달하고 추천 ID는 노출하지 않는다")
    void streamsBeforeTheAnswerStringIsCompleteAndAcceptsEitherFieldOrder() {
        // given
        ChatAnswerStream stream = new ChatAnswerStream(mapper);

        // when, then
        assertThat(stream.append("{\"recommendedItemIds\":[2],\"answer\":\"일부 ")).isEqualTo("일부 ");
        assertThat(stream.append("답변\"}")).isEqualTo("답변");
        assertThat(stream.finish()).isEqualTo(new ChatAnswer("일부 답변", List.of(2L)));
    }

    @ParameterizedTest
    @MethodSource("singleCharacterOutputs")
    @DisplayName("한 글자씩 수신해도 JSON처럼 보이는 답변과 이모지를 원문대로 전달한다")
    void streamsSingleCharacterChunksWithoutSplittingEmoji(String json, String expected) {
        ChatAnswerStream stream = new ChatAnswerStream(mapper);
        StringBuilder delivered = new StringBuilder();
        for (int index = 0; index < json.length(); index++) {
            String delta = stream.append(json.substring(index, index + 1));
            if (!delta.isEmpty()) {
                assertThat(Character.isHighSurrogate(delta.charAt(delta.length() - 1))).isFalse();
            }
            delivered.append(delta);
        }
        assertThat(delivered.toString()).isEqualTo(expected);
        assertThat(stream.finish()).isEqualTo(new ChatAnswer(expected, List.of(2L)));
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

        // when, then
        assertThatThrownBy(() -> {
            stream.append(json);
            stream.finish();
        }).isInstanceOf(BusinessException.class)
                .hasMessage("챗봇의 구조화된 응답이 올바르지 않습니다.");
    }

    static Stream<String> invalidOutputs() {
        return Stream.of(
                "",
                "{\"answer\":\"일부",
                "{\"answer\":\" \",\"recommendedItemIds\":[]}",
                "{\"answer\":\"답변\"}",
                "{\"answer\":\"답변\",\"recommendedItemIds\":null}",
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
                "{\"answer\":\"답변\",\"recommendedItemIds\":[]}{}"
        );
    }
}
