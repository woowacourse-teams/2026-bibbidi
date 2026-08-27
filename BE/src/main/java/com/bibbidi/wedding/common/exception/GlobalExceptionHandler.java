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
        ClientError clientError = exception.clientError();
        HttpStatus status = convertToHttpStatus(clientError);
        logException(exception, clientError, status, request);
        return ResponseEntity.status(status).body(ErrorResponse.from(clientError));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception exception, WebRequest request) {
        ClientError clientError = ClientError.INTERNAL_ERROR;
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        logException(exception, clientError, status, request);
        return ResponseEntity.status(status).body(ErrorResponse.from(clientError));
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception exception,
            Object body,
            HttpHeaders headers,
            HttpStatusCode statusCode,
            WebRequest request
    ) {
        ClientError clientError = convertToClientError(statusCode);
        Object response = createResponse(clientError, exception);
        logException(exception, clientError, statusCode, request);
        return super.handleExceptionInternal(exception, response, headers, statusCode, request);
    }

    private ClientError convertToClientError(HttpStatusCode statusCode) {
        if (statusCode.is4xxClientError()) {
            return ClientError.INVALID_REQUEST;
        }
        return ClientError.INTERNAL_ERROR;
    }

    private HttpStatus convertToHttpStatus(ClientError clientError) {
        return switch (clientError) {
            case INVALID_REQUEST -> HttpStatus.BAD_REQUEST;
            case AUTHENTICATION_REQUIRED -> HttpStatus.UNAUTHORIZED;
            case AUTHENTICATION_FAILED -> HttpStatus.UNAUTHORIZED;
            case DUPLICATE_NICKNAME -> HttpStatus.CONFLICT;
            case DUPLICATE_CHECKLIST -> HttpStatus.CONFLICT;
            case INTERNAL_ERROR -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
    }

    private Object createResponse(ClientError clientError, Exception exception) {
        if (!(exception instanceof MethodArgumentNotValidException validationException)) {
            return ErrorResponse.from(clientError);
        }

        List<ValidationErrorResponse.FieldError> errors = validationException.getBindingResult().getFieldErrors()
                .stream()
                .map(error -> new ValidationErrorResponse.FieldError(
                        error.getField(),
                        error.getDefaultMessage() == null ? "올바르지 않은 값입니다." : error.getDefaultMessage()))
                .toList();
        return ValidationErrorResponse.from(clientError, errors);
    }

    private void logException(
            Exception exception,
            ClientError clientError,
            HttpStatusCode statusCode,
            WebRequest request
    ) {
        String method = extractMethod(request);
        String uri = extractUri(request);
        int status = statusCode.value();

        if (statusCode.is5xxServerError()) {
            log.error(
                    "errorCode={} method={} uri={} status={}",
                    clientError.errorCode(), method, uri, status, exception);
            return;
        }

        if (exception instanceof BusinessException) {
            log.warn(
                    "errorCode={} method={} uri={} status={} message={}",
                    clientError.errorCode(), method, uri, status, exception.getMessage());
            return;
        }

        log.warn(
                "errorCode={} method={} uri={} status={}",
                clientError.errorCode(), method, uri, status);
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
