package com.bibbidi.wedding.chat.service.turn;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.concurrent.TimeoutException;

public enum FailureReason {
    THROTTLED,
    TIMEOUT,
    ERROR;

    public static FailureReason of(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof BusinessException business
                    && business.clientError() == ClientError.AI_CAPACITY_EXCEEDED) {
                return THROTTLED;
            }
            if (cause instanceof TimeoutException) {
                return TIMEOUT;
            }
        }
        return ERROR;
    }
}
