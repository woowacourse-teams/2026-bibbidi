package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

@Component
public class RequestOriginValidator {

    private final AuthWebProperties authWebProperties;

    public RequestOriginValidator(AuthWebProperties authWebProperties) {
        this.authWebProperties = authWebProperties;
    }

    public void validate(HttpServletRequest request) {
        String origin = request.getHeader(HttpHeaders.ORIGIN);
        if (!authWebProperties.allowedOrigins().contains(origin)) {
            throw new BusinessException(ClientError.AUTHENTICATION_FAILED, "허용하지 않는 출처에서 온 요청입니다.");
        }
    }
}
