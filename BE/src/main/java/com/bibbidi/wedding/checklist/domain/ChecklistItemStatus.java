package com.bibbidi.wedding.checklist.domain;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.Arrays;

public enum ChecklistItemStatus {
    PREV,
    CONTINUE,
    DONE;

    public static ChecklistItemStatus from(String value) {
        return Arrays.stream(values())
                .filter(status -> status.name().equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ClientError.INVALID_REQUEST,
                        "지원하지 않는 할 일 상태입니다. status=" + value
                ));
    }
}
