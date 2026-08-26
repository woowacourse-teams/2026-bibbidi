package com.bibbidi.wedding.common.exception;

import java.util.List;

public record ValidationErrorResponse(
        int errorCode,
        String message,
        List<FieldError> errors
) {

    public static ValidationErrorResponse from(ClientError clientError, List<FieldError> errors) {
        return new ValidationErrorResponse(
                clientError.errorCode(),
                clientError.message(),
                errors
        );
    }

    public record FieldError(String field, String message) {
    }
}
