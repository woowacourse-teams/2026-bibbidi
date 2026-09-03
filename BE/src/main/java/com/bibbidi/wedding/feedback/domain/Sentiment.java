package com.bibbidi.wedding.feedback.domain;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.Arrays;

public enum Sentiment {
    GOOD("good"),
    BAD("bad");

    private final String value;

    Sentiment(String value) {
        this.value = value;
    }

    public static Sentiment from(String value) {
        return Arrays.stream(values())
                .filter(sentiment -> sentiment.value.equals(value))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ClientError.INVALID_REQUEST,
                        "지원하지 않는 피드백 평가값입니다. sentiment=" + value
                ));
    }
}
