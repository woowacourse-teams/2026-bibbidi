package com.bibbidi.wedding.common.exception;

public enum ClientError {
    INVALID_REQUEST(101, "요청 값이 올바르지 않습니다."),
    AUTHENTICATION_REQUIRED(201, "로그인이 필요합니다."),
    AUTHENTICATION_FAILED(202, "인증 정보가 올바르지 않습니다."),
    DUPLICATE_NICKNAME(401, "이미 사용 중인 닉네임입니다."),
    DUPLICATE_CHECKLIST(402, "이미 체크리스트가 존재합니다."),
    INTERNAL_ERROR(901, "요청을 처리하는 중 오류가 발생했습니다.");

    private final int errorCode;
    private final String message;

    ClientError(int errorCode, String message) {
        this.errorCode = errorCode;
        this.message = message;
    }

    public int errorCode() {
        return errorCode;
    }

    public String message() {
        return message;
    }
}
