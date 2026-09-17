package com.bibbidi.wedding.common.exception;

public record ErrorResponse(int errorCode, String message) {

    public static ErrorResponse from(ClientError clientError) {
        return new ErrorResponse(
                clientError.errorCode(),
                clientError.message()
        );
    }
}
