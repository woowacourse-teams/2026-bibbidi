package com.bibbidi.wedding.common.exception;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException exception, WebRequest request) {
        ProblemType type = exception.problemType();
        logException(exception, type, request);
        return ResponseEntity.status(type.status()).body(ErrorResponse.from(type));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception exception, WebRequest request) {
        ProblemType type = ProblemType.INTERNAL_ERROR;
        logException(exception, type, request);
        return ResponseEntity.status(type.status()).body(ErrorResponse.from(type));
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception exception,
            Object body,
            HttpHeaders headers,
            HttpStatusCode statusCode,
            WebRequest request
    ) {
        ProblemType type = convertToProblemType(exception, statusCode);
        Object response = createResponse(type, exception);
        logException(exception, type, request);
        return super.handleExceptionInternal(exception, response, headers, type.status(), request);
    }

    private ProblemType convertToProblemType(Exception exception, HttpStatusCode statusCode) {
        if (exception instanceof MethodArgumentNotValidException) {
            return ProblemType.VALIDATION_FAILED;
        }
        if (statusCode.equals(HttpStatus.NOT_FOUND)) {
            return ProblemType.RESOURCE_NOT_FOUND;
        }
        if (statusCode.equals(HttpStatus.FORBIDDEN)) {
            return ProblemType.ACCESS_DENIED;
        }
        if (statusCode.equals(HttpStatus.METHOD_NOT_ALLOWED)) {
            return ProblemType.METHOD_NOT_ALLOWED;
        }
        if (statusCode.equals(HttpStatus.UNSUPPORTED_MEDIA_TYPE)) {
            return ProblemType.UNSUPPORTED_MEDIA_TYPE;
        }
        if (statusCode.equals(HttpStatus.CONFLICT)) {
            return ProblemType.CONFLICT;
        }
        if (statusCode.equals(HttpStatus.UNPROCESSABLE_ENTITY)) {
            return ProblemType.UNPROCESSABLE_ENTITY;
        }
        if (statusCode.is4xxClientError()) {
            return ProblemType.INVALID_REQUEST;
        }
        return ProblemType.INTERNAL_ERROR;
    }

    private Object createResponse(ProblemType type, Exception exception) {
        if (!(exception instanceof MethodArgumentNotValidException validationException)) {
            return ErrorResponse.from(type);
        }

        List<ValidationErrorResponse.FieldError> errors = validationException.getBindingResult().getFieldErrors()
                .stream()
                .map(error -> new ValidationErrorResponse.FieldError(
                        error.getField(),
                        error.getDefaultMessage() == null ? "올바르지 않은 값입니다." : error.getDefaultMessage()))
                .toList();
        return ValidationErrorResponse.from(type, errors);
    }

    private void logException(Exception exception, ProblemType type, WebRequest request) {
        String method = extractMethod(request);
        String uri = extractUri(request);
        int status = type.status().value();

        if (type.status().is5xxServerError()) {
            log.error(
                    "errorId={} method={} uri={} status={}",
                    type.id(), method, uri, status, exception);
            return;
        }

        log.warn(
                "errorId={} method={} uri={} status={}",
                type.id(), method, uri, status);
    }

    private String extractUri(WebRequest request) {
        if (request instanceof ServletWebRequest servletRequest) {
            return servletRequest.getRequest().getRequestURI();
        }
        return "";
    }

    private String extractMethod(WebRequest request) {
        if (request instanceof ServletWebRequest servletRequest) {
            return servletRequest.getRequest().getMethod();
        }
        return "";
    }
}
