package com.bibbidi.wedding.chat.service.port;

import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import java.util.List;

/** 모델 응답의 원문과 어댑터가 추출한 답변을 함께 전달한다. */
public sealed interface AiResponse {

    record Chunk(String raw, List<String> answerDeltas) implements AiResponse {
    }

    record Answer(ChatAnswer value) implements AiResponse {
    }
}
