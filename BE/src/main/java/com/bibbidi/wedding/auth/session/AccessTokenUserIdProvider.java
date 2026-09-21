package com.bibbidi.wedding.auth.session;

import com.bibbidi.wedding.auth.token.AccessTokenProvider;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

@Component
public class AccessTokenUserIdProvider {

    private static final String BEARER_PREFIX = "Bearer ";

    private final AccessTokenProvider accessTokenProvider;

    public AccessTokenUserIdProvider(AccessTokenProvider accessTokenProvider) {
        this.accessTokenProvider = accessTokenProvider;
    }

    public Optional<String> findAuthorizationHeader(HttpServletRequest request) {
        return Optional.ofNullable(request.getHeader(HttpHeaders.AUTHORIZATION));
    }

    public Long getCurrentUserId(String authorizationHeader) {
        if (!authorizationHeader.startsWith(BEARER_PREFIX)) {
            throw new BusinessException(
                    ClientError.AUTHENTICATION_FAILED, "현재 사용자 ID 조회 실패: Authorization 헤더가 Bearer 형식이 아닙니다.");
        }

        String accessToken = authorizationHeader.substring(BEARER_PREFIX.length()).trim();
        if (accessToken.isEmpty()) {
            throw new BusinessException(
                    ClientError.AUTHENTICATION_FAILED, "현재 사용자 ID 조회 실패: Bearer 뒤에 토큰이 없습니다.");
        }

        return accessTokenProvider.parseUserId(accessToken);
    }
}
