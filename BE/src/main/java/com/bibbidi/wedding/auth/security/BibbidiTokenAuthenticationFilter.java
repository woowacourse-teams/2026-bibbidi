package com.bibbidi.wedding.auth.security;

import com.bibbidi.wedding.auth.config.properties.BibbidiTokenProperties;
import com.bibbidi.wedding.auth.token.BibbidiTokenClaims;
import com.bibbidi.wedding.auth.token.BibbidiTokenParser;
import com.bibbidi.wedding.common.exception.BusinessException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.filter.OncePerRequestFilter;

public class BibbidiTokenAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final BibbidiTokenParser bibbidiTokenParser;
    private final AuthenticationFailureResponseWriter failureResponseWriter;
    private final String headerName;
    private final SecurityContextRepository securityContextRepository;

    public BibbidiTokenAuthenticationFilter(
            BibbidiTokenParser bibbidiTokenParser,
            AuthenticationFailureResponseWriter failureResponseWriter,
            BibbidiTokenProperties bibbidiTokenProperties,
            SecurityContextRepository securityContextRepository
    ) {
        this.bibbidiTokenParser = bibbidiTokenParser;
        this.failureResponseWriter = failureResponseWriter;
        this.headerName = bibbidiTokenProperties.headerName();
        this.securityContextRepository = securityContextRepository;
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
            saveAuthenticationForReDispatch(user, request, response);
        } catch (BusinessException exception) {
            SecurityContextHolder.clearContext();
            failureResponseWriter.write(request, response, exception);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void saveAuthenticationForReDispatch(AuthenticatedUser user, HttpServletRequest request,
                                                 HttpServletResponse response) {
        PreAuthenticatedAuthenticationToken authenticatedAuthenticationToken = new PreAuthenticatedAuthenticationToken(
                user,
                null,
                user.getAuthorities()
        );

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authenticatedAuthenticationToken);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
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
