package com.bibbidi.wedding.auth.security;

import com.bibbidi.wedding.auth.config.BibbidiTokenProperties;
import com.bibbidi.wedding.auth.token.BibbidiTokenClaims;
import com.bibbidi.wedding.auth.token.BibbidiTokenParser;
import com.bibbidi.wedding.common.exception.BusinessException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

public class BibbidiTokenAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final BibbidiTokenParser bibbidiTokenParser;
    private final AuthenticationFailureResponseWriter failureResponseWriter;
    private final String headerName;

    public BibbidiTokenAuthenticationFilter(
            BibbidiTokenParser bibbidiTokenParser,
            AuthenticationFailureResponseWriter failureResponseWriter,
            BibbidiTokenProperties bibbidiTokenProperties
    ) {
        this.bibbidiTokenParser = bibbidiTokenParser;
        this.failureResponseWriter = failureResponseWriter;
        this.headerName = bibbidiTokenProperties.headerName();
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
            failureResponseWriter.write(request, response, exception);
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
