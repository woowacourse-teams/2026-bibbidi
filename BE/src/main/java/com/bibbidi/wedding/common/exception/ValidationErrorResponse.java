package com.bibbidi.wedding.common.exception;

import java.util.List;

public record ValidationErrorResponse(
        int id,
        int status,
        String message,
        List<FieldError> errors
) {

    public static ValidationErrorResponse from(ClientError clientError, List<FieldError> errors) {
        return new ValidationErrorResponse(
                clientError.id(),
                clientError.status().value(),
                clientError.clientMessage(),
                errors
        );
    }

    public record FieldError(String field, String message) {
    }
}
