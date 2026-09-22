package com.bibbidi.wedding.auth.security;

import com.bibbidi.wedding.auth.token.BibbidiTokenClaims;
import com.bibbidi.wedding.auth.token.BibbidiTokenParser;
import com.bibbidi.wedding.auth.token.JwtProperties;
import com.bibbidi.wedding.common.exception.BusinessException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 요청 헤더에 실린 비비디 토큰을 검사해 SecurityContext에 사용자를 올린다. 제공자가 준 id_token과는 다른, 우리가 발급한 토큰이다. 토큰이 없으면 그대로 통과시켜 비로그인 허용 경로가
 * 동작하게 하고, 토큰이 있는데 올바르지 않으면 인증 진입점이 401을 내도록 예외를 남긴다.
 */
public class BibbidiTokenAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final BibbidiTokenParser bibbidiTokenParser;
    private final AuthenticationFailureResponseWriter failureResponseWriter;
    private final String headerName;

    public BibbidiTokenAuthenticationFilter(
            BibbidiTokenParser bibbidiTokenParser,
            AuthenticationFailureResponseWriter failureResponseWriter,
            JwtProperties jwtProperties
    ) {
        this.bibbidiTokenParser = bibbidiTokenParser;
        this.failureResponseWriter = failureResponseWriter;
        this.headerName = jwtProperties.headerName();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String token = bearerToken(request);

        if (token == null) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            BibbidiTokenClaims claims = bibbidiTokenParser.parseAccessToken(token);
            AuthenticatedUser user = new AuthenticatedUser(
                    claims.userId(),
                    claims.role(),
                    claims.status(),
                    claims.nickname(),
                    claims.email()
            );
            SecurityContextHolder.getContext().setAuthentication(
                    new PreAuthenticatedAuthenticationToken(
                            user,
                            null,
                            user.getAuthorities()
                    )
            );
        } catch (BusinessException exception) {
            SecurityContextHolder.clearContext();
            failureResponseWriter.respond(request, response, exception);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String bearerToken(HttpServletRequest request) {
        String header = request.getHeader(headerName);
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            return null;
        }
        String token = header.substring(BEARER_PREFIX.length()).trim();
        return token.isEmpty() ? null : token;
    }
}
