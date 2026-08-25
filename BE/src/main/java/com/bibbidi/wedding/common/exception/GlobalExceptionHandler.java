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
        logException(exception, clientError, request);
        return ResponseEntity.status(clientError.status()).body(ErrorResponse.from(clientError));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception exception, WebRequest request) {
        ClientError clientError = ClientError.INTERNAL_ERROR;
        logException(exception, clientError, request);
        return ResponseEntity.status(clientError.status()).body(ErrorResponse.from(clientError));
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception exception,
            Object body,
            HttpHeaders headers,
            HttpStatusCode statusCode,
            WebRequest request
    ) {
        ClientError clientError = convertToClientError(exception, statusCode);
        Object response = createResponse(clientError, exception);
        logException(exception, clientError, request);
        return super.handleExceptionInternal(exception, response, headers, clientError.status(), request);
    }

    private ClientError convertToClientError(Exception exception, HttpStatusCode statusCode) {
        if (exception instanceof MethodArgumentNotValidException) {
            return ClientError.VALIDATION_FAILED;
        }
        if (statusCode.equals(HttpStatus.NOT_FOUND)) {
            return ClientError.RESOURCE_NOT_FOUND;
        }
        if (statusCode.equals(HttpStatus.FORBIDDEN)) {
            return ClientError.ACCESS_DENIED;
        }
        if (statusCode.equals(HttpStatus.METHOD_NOT_ALLOWED)) {
            return ClientError.METHOD_NOT_ALLOWED;
        }
        if (statusCode.equals(HttpStatus.UNSUPPORTED_MEDIA_TYPE)) {
            return ClientError.UNSUPPORTED_MEDIA_TYPE;
        }
        if (statusCode.equals(HttpStatus.CONFLICT)) {
            return ClientError.CONFLICT;
        }
        if (statusCode.equals(HttpStatus.UNPROCESSABLE_ENTITY)) {
            return ClientError.UNPROCESSABLE_ENTITY;
        }
        if (statusCode.is4xxClientError()) {
            return ClientError.INVALID_REQUEST;
        }
        return ClientError.INTERNAL_ERROR;
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

    private void logException(Exception exception, ClientError clientError, WebRequest request) {
        String method = extractMethod(request);
        String uri = extractUri(request);
        int status = clientError.status().value();

        if (clientError.status().is5xxServerError()) {
            log.error(
                    "errorId={} method={} uri={} status={}",
                    clientError.id(), method, uri, status, exception);
            return;
        }

        if (exception instanceof BusinessException) {
            log.warn(
                    "errorId={} method={} uri={} status={} message={}",
                    clientError.id(), method, uri, status, exception.getMessage());
            return;
        }

        log.warn(
                "errorId={} method={} uri={} status={}",
                clientError.id(), method, uri, status);
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
