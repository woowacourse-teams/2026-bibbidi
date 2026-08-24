package com.bibbidi.wedding.common.exception;

import java.util.List;

public record ValidationErrorResponse(
        int id,
        int status,
        String message,
        List<FieldError> errors
) {

    public static ValidationErrorResponse from(ProblemType type, List<FieldError> errors) {
        return new ValidationErrorResponse(type.id(), type.status().value(), type.clientMessage(), errors);
    }

    public record FieldError(String field, String message) {
    }
}
