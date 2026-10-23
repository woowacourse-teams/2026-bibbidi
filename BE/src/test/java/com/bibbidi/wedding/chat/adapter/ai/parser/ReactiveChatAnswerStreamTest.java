package com.bibbidi.wedding.chat.adapter.ai.parser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.common.exception.BusinessException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ReactiveChatAnswerStreamTest {

    private List<String> deltas;
    private ReactiveChatAnswerStream stream;

    @BeforeEach
    void setUp() {
        deltas = new ArrayList<>();
        stream = new ReactiveChatAnswerStream(JsonMapper.builder().build(), deltas::add);
    }

    @Test
    @DisplayName("이스케이프가 모델 조각 경계에서 나뉘어도 답변을 디코딩해 전달하고 완료 후 추천 ID를 검증한다")
    void streamsEscapedAnswerAcrossModelChunksAndValidatesTheCompletedJson() {
        // given
        String firstChunk = "{\"recommendedItemIds\":[2],\"ans";
        String secondChunk = "wer\":\"한\\uD83D";
        String thirdChunk = "\\uDC8A\\n끝\"}";

        // when
        stream.accept(firstChunk);
        stream.accept(secondChunk);
        stream.accept(thirdChunk);

        // then
        assertThat(deltas).containsExactly("한", "💊\n끝");
        assertThat(stream.finish().recommendedItemIds()).containsExactly(2L);
    }

    @Test
    @DisplayName("답변을 전달한 뒤 추천 ID가 잘못된 것으로 확인되면 완료를 거절한다")
    void rejectsMalformedRecommendationsAfterStreamingTheAnswer() {
        // given
        String invalidOutput = "{\"answer\":\"답변\",\"recommendedItemIds\":[\"1\"]}";

        // when
        stream.accept(invalidOutput);

        // then
        assertThat(deltas).containsExactly("답변");
        assertThatThrownBy(stream::finish).isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("answer 필드가 시작되기 전에는 아무것도 전달하지 않는다")
    void emitsNothingBeforeTheAnswerFieldStarts() {
        // when
        stream.accept("{\"recommendedItemIds\":[1,");

        // then
        assertThat(deltas).isEmpty();
    }

    @Test
    @DisplayName("answer 필드가 닫힌 뒤에 오는 조각은 전달하지 않는다")
    void ignoresChunksAfterTheAnswerFieldEnds() {
        // given
        stream.accept("{\"answer\":\"답변\",");

        // when
        stream.accept("\"recommendedItemIds\":[]}");

        // then
        assertThat(deltas).containsExactly("답변");
    }
}
