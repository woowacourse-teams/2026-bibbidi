package com.bibbidi.wedding.chat.infra.ai;

import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonParser;
import tools.jackson.core.StreamReadFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.ObjectReader;

public final class ChatAnswerStream {

    private static final String ANSWER_FIELD = "answer";
    private static final String RECOMMENDATIONS_FIELD = "recommendedItemIds";
    private static final String INVALID_OUTPUT = "챗봇의 구조화된 응답이 올바르지 않습니다.";

    private final ObjectReader responseReader;
    private final StringBuilder json = new StringBuilder();
    private final StringBuilder answer = new StringBuilder();
    private final StringBuilder fieldName = new StringBuilder();
    private ReadTarget target = ReadTarget.JSON;
    private int depth;
    private int sentLength;
    private int remainingUnicodeDigits;
    private int unicodeValue;
    private boolean expectingField;
    private boolean escaped;

    public ChatAnswerStream(ObjectMapper mapper) {
        responseReader = mapper.reader().with(StreamReadFeature.STRICT_DUPLICATE_DETECTION);
    }

    public String append(String chunk) {
        json.append(chunk);
        for (int index = 0; index < chunk.length(); index++) {
            char character = chunk.charAt(index);
            if (target == ReadTarget.JSON) {
                readStructure(character);
            } else {
                readString(character);
            }
        }
        return takeAnswerDelta();
    }

    public ChatAnswer finish() {
        JsonNode response = readCompleteResponse();
        String completeAnswer = response.path(ANSWER_FIELD).asString();
        if (completeAnswer.isBlank() || !completeAnswer.contentEquals(answer) || sentLength != answer.length()) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, INVALID_OUTPUT);
        }
        return new ChatAnswer(completeAnswer, readRecommendationIds(response.path(RECOMMENDATIONS_FIELD)));
    }

    private String takeAnswerDelta() {
        int end = answer.length();
        if (end > 0 && Character.isHighSurrogate(answer.charAt(end - 1))) {
            end--;
        }
        String delta = answer.substring(sentLength, end);
        sentLength = end;
        return delta;
    }

    private void readStructure(char character) {
        switch (character) {
            case '{', '[' -> {
                depth++;
                if (depth == 1) {
                    expectingField = true;
                }
            }
            case '}', ']' -> depth--;
            case ',' -> {
                if (depth == 1) {
                    expectingField = true;
                }
            }
            case '"' -> {
                if (depth == 1 && expectingField) {
                    target = ReadTarget.FIELD_NAME;
                    fieldName.setLength(0);
                } else {
                    target = depth == 1 && fieldName.toString().equals(ANSWER_FIELD)
                            ? ReadTarget.ANSWER : ReadTarget.OTHER_STRING;
                }
            }
            default -> { }
        }
    }

    private void readString(char character) {
        if (remainingUnicodeDigits > 0) {
            readUnicodeDigit(character);
            return;
        }
        if (escaped) {
            readEscape(character);
            return;
        }
        switch (character) {
            case '\\' -> escaped = true;
            case '"' -> {
                if (target == ReadTarget.FIELD_NAME) {
                    expectingField = false;
                }
                target = ReadTarget.JSON;
            }
            default -> appendDecoded(character);
        }
    }

    private void readUnicodeDigit(char character) {
        int digit = Character.digit(character, 16);
        if (digit < 0) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, INVALID_OUTPUT);
        }
        unicodeValue = unicodeValue * 16 + digit;
        if (--remainingUnicodeDigits == 0) {
            appendDecoded((char) unicodeValue);
        }
    }

    private void readEscape(char character) {
        escaped = false;
        if (character == 'u') {
            remainingUnicodeDigits = 4;
            unicodeValue = 0;
            return;
        }
        appendDecoded(switch (character) {
            case '"', '\\', '/' -> character;
            case 'n' -> '\n';
            case 'r' -> '\r';
            case 't' -> '\t';
            case 'b' -> '\b';
            case 'f' -> '\f';
            default -> throw new BusinessException(ClientError.INTERNAL_ERROR, INVALID_OUTPUT);
        });
    }

    private void appendDecoded(char character) {
        switch (target) {
            case FIELD_NAME -> fieldName.append(character);
            case ANSWER -> answer.append(character);
            default -> { }
        }
    }

    private JsonNode readCompleteResponse() {
        try (JsonParser parser = responseReader.createParser(json.toString())) {
            JsonNode response = responseReader.readTree(parser);
            if (!hasExpectedFields(response) || parser.nextToken() != null) {
                throw new BusinessException(ClientError.INTERNAL_ERROR, INVALID_OUTPUT);
            }
            return response;
        } catch (JacksonException exception) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, INVALID_OUTPUT);
        }
    }

    private boolean hasExpectedFields(@Nullable JsonNode response) {
        return response != null && response.isObject() && response.size() == 2
                && response.path(ANSWER_FIELD).isString()
                && response.path(RECOMMENDATIONS_FIELD).isArray();
    }

    private List<Long> readRecommendationIds(JsonNode recommendations) {
        List<Long> ids = new ArrayList<>();
        for (JsonNode id : recommendations) {
            if (!id.isIntegralNumber() || !id.canConvertToLong() || id.asLong() <= 0) {
                throw new BusinessException(ClientError.INTERNAL_ERROR, INVALID_OUTPUT);
            }
            ids.add(id.asLong());
        }
        return List.copyOf(ids);
    }

    private enum ReadTarget {
        JSON, FIELD_NAME, ANSWER, OTHER_STRING
    }
}
