package com.bibbidi.wedding.common.exception;

public record ErrorResponse(int id, int status, String message) {

    public static ErrorResponse from(ProblemType type) {
        return new ErrorResponse(
                type.id(),
                type.status().value(),
                type.clientMessage()
        );
    }
}
