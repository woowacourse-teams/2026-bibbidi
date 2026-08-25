package com.bibbidi.wedding.common.exception;

import org.springframework.http.HttpStatus;

public enum ClientError {

    INVALID_REQUEST(101, HttpStatus.BAD_REQUEST, "요청 형식이 올바르지 않습니다."),
    VALIDATION_FAILED(102, HttpStatus.BAD_REQUEST, "요청 값이 올바르지 않습니다."),
    AUTHENTICATION_REQUIRED(201, HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    AUTHENTICATION_FAILED(202, HttpStatus.UNAUTHORIZED, "인증 정보가 올바르지 않습니다."),
    ACCESS_DENIED(203, HttpStatus.FORBIDDEN, "해당 요청을 수행할 권한이 없습니다."),
    RESOURCE_NOT_FOUND(301, HttpStatus.NOT_FOUND, "요청한 리소스를 찾을 수 없습니다."),
    CONFLICT(401, HttpStatus.CONFLICT, "요청이 현재 리소스 상태와 충돌합니다."),
    UNPROCESSABLE_ENTITY(402, HttpStatus.UNPROCESSABLE_ENTITY, "요청을 처리할 수 없습니다."),
    DUPLICATE_NICKNAME(403, HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다."),
    METHOD_NOT_ALLOWED(501, HttpStatus.METHOD_NOT_ALLOWED, "지원하지 않는 HTTP 메서드입니다."),
    UNSUPPORTED_MEDIA_TYPE(502, HttpStatus.UNSUPPORTED_MEDIA_TYPE, "지원하지 않는 미디어 타입입니다."),
    INTERNAL_ERROR(901, HttpStatus.INTERNAL_SERVER_ERROR, "요청을 처리하는 중 오류가 발생했습니다.");

    private final int id;
    private final HttpStatus status;
    private final String clientMessage;

    ClientError(int id, HttpStatus status, String clientMessage) {
        this.id = id;
        this.status = status;
        this.clientMessage = clientMessage;
    }

    public int id() {
        return id;
    }

    public HttpStatus status() {
        return status;
    }

    public String clientMessage() {
        return clientMessage;
    }
}
