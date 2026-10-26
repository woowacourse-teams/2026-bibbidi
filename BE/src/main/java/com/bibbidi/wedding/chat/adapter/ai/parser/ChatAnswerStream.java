package com.bibbidi.wedding.chat.adapter.ai.parser;

import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.stream.Stream;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.core.StreamReadFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.ObjectReader;

public final class ChatAnswerStream {

    private static final String INVALID_OUTPUT = "챗봇의 구조화된 응답이 올바르지 않습니다.";

    private final ObjectReader responseReader;

    public ChatAnswerStream(ObjectMapper mapper) {
        responseReader = mapper.reader().with(StreamReadFeature.STRICT_DUPLICATE_DETECTION);
    }

    public ChatResult.Answer read(Stream<String> chunks, Consumer<String> sendAnswerChunk) {
        try (chunks; JsonParser parser = responseReader.createParser(new ChunkedReader(chunks.iterator()))) {
            return readResponse(parser, new AnswerDeltaWriter(sendAnswerChunk));
        } catch (JacksonException exception) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, INVALID_OUTPUT);
        }
    }

    private ChatResult.Answer readResponse(JsonParser parser, AnswerDeltaWriter answerWriter) {
        if (parser.nextToken() != JsonToken.START_OBJECT) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, INVALID_OUTPUT);
        }

        List<Long> recommendedItemIds = null;
        while (parser.nextToken() == JsonToken.PROPERTY_NAME) {
            String field = parser.currentName();
            JsonToken value = parser.nextToken();
            if ("answer".equals(field) && value == JsonToken.VALUE_STRING) {
                parser.readString(answerWriter);
            } else if ("recommendedItemIds".equals(field) && value == JsonToken.START_ARRAY) {
                recommendedItemIds = readRecommendationIds(parser);
            } else {
                throw new BusinessException(ClientError.INTERNAL_ERROR, INVALID_OUTPUT);
            }
        }

        String answer = answerWriter.text();
        if (parser.currentToken() != JsonToken.END_OBJECT || parser.nextToken() != null
                || answer.isBlank() || answerWriter.hasPendingText() || recommendedItemIds == null) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, INVALID_OUTPUT);
        }
        return new ChatResult.Answer(answer, recommendedItemIds);
    }

    private List<Long> readRecommendationIds(JsonParser parser) {
        List<Long> ids = new ArrayList<>();
        while (parser.nextToken() != JsonToken.END_ARRAY) {
            if (parser.currentToken() != JsonToken.VALUE_NUMBER_INT) {
                throw new BusinessException(ClientError.INTERNAL_ERROR, INVALID_OUTPUT);
            }
            long id = parser.getLongValue();
            if (id <= 0) {
                throw new BusinessException(ClientError.INTERNAL_ERROR, INVALID_OUTPUT);
            }
            ids.add(id);
        }
        return List.copyOf(ids);
    }
}
