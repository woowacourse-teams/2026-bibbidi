package com.bibbidi.wedding.support;

import com.bibbidi.wedding.auth.security.AuthenticatedUser;
import com.bibbidi.wedding.auth.token.AccessTokenClaims;
import com.bibbidi.wedding.auth.token.AccessTokenIssuer;
import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** 테스트에서 로그인한 상태를 만든다. */
public final class AuthenticationTestSupport {

    public static final String DOCUMENTED_AUTHORIZATION_HEADER = "Bearer <access-token>";

    private AuthenticationTestSupport() {
    }

    /** 실제 필터를 거치는 테스트용. 서명까지 진짜인 토큰을 만든다. */
    public static String bearerTokenOf(AccessTokenIssuer issuer, Long userId, String nickname) {
        return bearerTokenOf(issuer, userId, nickname, UserStatus.ACTIVE);
    }

    public static String bearerTokenOf(
            AccessTokenIssuer issuer, Long userId, String nickname, UserStatus status) {
        return "Bearer " + issuer.issueAccessToken(
                new AccessTokenClaims(userId, status, UserRole.NORMAL, nickname, null));
    }

    /** 토큰을 만들지 않고 인증을 마친 상태만 필요한 테스트용이다. */
    public static RequestPostProcessor authenticatedUser(Long userId) {
        return authenticatedUser(userId, UserStatus.ACTIVE);
    }

    public static RequestPostProcessor authenticatedUser(Long userId, UserStatus status) {
        AuthenticatedUser user =
                new AuthenticatedUser(userId, UserRole.NORMAL, status, "테스트회원", null);
        return SecurityMockMvcRequestPostProcessors.authentication(
                UsernamePasswordAuthenticationToken.authenticated(user, null, user.getAuthorities()));
    }
}
