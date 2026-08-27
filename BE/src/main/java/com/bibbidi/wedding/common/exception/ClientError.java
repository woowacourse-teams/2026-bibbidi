package com.bibbidi.wedding.common.exception;

import org.springframework.http.HttpStatus;

public enum ClientError {
    // 100: 요청 오류
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, 101, "요청 값이 올바르지 않습니다."),

    // 200: 인증 오류
    AUTHENTICATION_REQUIRED(HttpStatus.UNAUTHORIZED, 201, "로그인이 필요합니다."),
    AUTHENTICATION_FAILED(HttpStatus.UNAUTHORIZED, 202, "인증 정보가 올바르지 않습니다."),

    // 300 : 리소스 오류
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, 301, "사용자를 찾을 수 없습니다."),
    APPOINTMENT_NOT_FOUND(HttpStatus.NOT_FOUND, 302, "일정을 찾을 수 없습니다."),
    CHECKLIST_NOT_FOUND(HttpStatus.NOT_FOUND, 303, "체크리스트를 찾을 수 없습니다."),

    // 400: 비즈니스 오류
    DUPLICATE_NICKNAME(HttpStatus.CONFLICT, 401, "이미 사용 중인 닉네임입니다."),
    DUPLICATE_CHECKLIST(HttpStatus.CONFLICT, 402, "이미 체크리스트가 존재합니다."),

    // 900: 서버 오류
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, 901, "요청을 처리하는 중 오류가 발생했습니다.");

    private final HttpStatus httpStatus;
    private final int errorCode;
    private final String message;

    ClientError(HttpStatus httpStatus, int errorCode, String message) {
        this.httpStatus = httpStatus;
        this.errorCode = errorCode;
        this.message = message;
    }

    public HttpStatus httpStatus() {
        return httpStatus;
    }

    public int errorCode() {
        return errorCode;
    }

    public String message() {
        return message;
    }
}
