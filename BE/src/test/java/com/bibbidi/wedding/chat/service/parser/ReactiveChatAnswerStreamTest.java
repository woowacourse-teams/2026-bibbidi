package com.bibbidi.wedding.chat.service.parser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.common.exception.BusinessException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ReactiveChatAnswerStreamTest {

    @Test
    void streamsEscapedAnswerAcrossModelChunksAndValidatesTheCompletedJson() {
        List<String> deltas = new ArrayList<>();
        ReactiveChatAnswerStream stream = new ReactiveChatAnswerStream(JsonMapper.builder().build(), deltas::add);

        stream.accept("{\"recommendedItemIds\":[2],\"ans");
        stream.accept("wer\":\"한\\uD83D");
        stream.accept("\\uDC8A\\n끝\"}");

        assertThat(deltas).containsExactly("한", "💊\n끝");
        assertThat(stream.finish().recommendedItemIds()).containsExactly(2L);
    }

    @Test
    void rejectsMalformedRecommendationsAfterStreamingTheAnswer() {
        List<String> deltas = new ArrayList<>();
        ReactiveChatAnswerStream stream = new ReactiveChatAnswerStream(JsonMapper.builder().build(), deltas::add);

        stream.accept("{\"answer\":\"답변\",\"recommendedItemIds\":[\"1\"]}");

        assertThat(deltas).containsExactly("답변");
        assertThatThrownBy(stream::finish).isInstanceOf(BusinessException.class);
    }
}
