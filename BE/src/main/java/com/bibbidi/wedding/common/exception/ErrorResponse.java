package com.bibbidi.wedding.common.exception;

public record ErrorResponse(int id, int status, String message) {

    public static ErrorResponse from(ClientError clientError) {
        return new ErrorResponse(
                clientError.id(),
                clientError.status().value(),
                clientError.clientMessage()
        );
    }
}
