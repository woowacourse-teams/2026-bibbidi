package com.bibbidi.wedding.common.exception;

import org.springframework.http.HttpStatus;

public enum ClientError {
    // 100: 요청 오류
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, 101, "요청 값이 올바르지 않습니다."),
    INVALID_APPOINTMENT_TIME_RANGE(HttpStatus.BAD_REQUEST, 102, "일정의 시작 시각은 종료 시각보다 늦을 수 없습니다."),

    // 200: 인증/인가 오류
    AUTHENTICATION_REQUIRED(HttpStatus.UNAUTHORIZED, 201, "로그인이 필요합니다."),
    AUTHENTICATION_FAILED(HttpStatus.UNAUTHORIZED, 202, "인증 정보가 올바르지 않습니다."),
    CHECKLIST_ITEM_ACCESS_DENIED(HttpStatus.FORBIDDEN, 203, "해당 할 일에 대한 작업 권한이 없습니다."),

    // 300 : 리소스 오류
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, 301, "사용자를 찾을 수 없습니다."),
    APPOINTMENT_NOT_FOUND(HttpStatus.NOT_FOUND, 302, "일정을 찾을 수 없습니다."),
    CHECKLIST_NOT_FOUND(HttpStatus.NOT_FOUND, 303, "체크리스트를 찾을 수 없습니다."),
    CHECKLIST_ITEM_NOT_FOUND(HttpStatus.NOT_FOUND, 304, "할 일을 찾을 수 없습니다."),
    CATEGORY_NOT_FOUND(HttpStatus.NOT_FOUND, 305, "카테고리를 찾을 수 없습니다."),

    // 400: 비즈니스 오류
    DUPLICATE_NICKNAME(HttpStatus.CONFLICT, 401, "이미 사용 중인 닉네임입니다."),
    DUPLICATE_CHECKLIST(HttpStatus.CONFLICT, 402, "이미 체크리스트가 존재합니다."),
    DUPLICATE_CHECKLIST_ITEM(HttpStatus.CONFLICT, 403, "이미 추가된 준비 항목입니다."),
    CHECKLIST_ITEM_CATEGORY_NOT_CHANGEABLE(
            HttpStatus.UNPROCESSABLE_CONTENT, 404, "준비 목록에서 추가한 할 일은 카테고리를 변경할 수 없습니다."),
    CHECKLIST_ITEM_TITLE_NOT_CHANGEABLE(
            HttpStatus.UNPROCESSABLE_CONTENT, 405, "준비 목록에서 추가한 할 일은 제목을 변경할 수 없습니다."),
    COMPLETED_CHECKLIST_ITEM_NOT_DELETABLE(
            HttpStatus.UNPROCESSABLE_CONTENT, 406, "완료된 할 일은 삭제할 수 없습니다."),

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
