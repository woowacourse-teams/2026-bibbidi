package com.bibbidi.wedding.auth.security;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.common.exception.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Component
public class AuthenticationFailureResponseWriter {

    private final ObjectMapper objectMapper;

    public AuthenticationFailureResponseWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void write(
            HttpServletRequest request,
            HttpServletResponse response,
            BusinessException exception
    ) throws IOException {
        write(request, response, exception.clientError(), exception.getMessage());
    }

    public void write(
            HttpServletRequest request,
            HttpServletResponse response,
            ClientError error,
            String logMessage
    ) throws IOException {
        log.warn(
                "errorCode={} method={} uri={} status={} message={}",
                error.errorCode(),
                request.getMethod(),
                request.getRequestURI(),
                error.httpStatus().value(),
                logMessage
        );

        response.setStatus(error.httpStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), ErrorResponse.from(error));
    }
}
