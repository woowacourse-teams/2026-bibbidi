package com.bibbidi.wedding.common.exception;

public class BusinessException extends RuntimeException {

    private final ClientError clientError;

    public BusinessException(ClientError clientError, String logMessage) {
        super(logMessage);
        this.clientError = clientError;
    }

    public BusinessException(ClientError clientError, String logMessage, Throwable cause) {
        super(logMessage, cause);
        this.clientError = clientError;
    }

    public ClientError clientError() {
        return clientError;
    }
}
