package com.bibbidi.wedding.auth.config;

import com.bibbidi.wedding.auth.config.properties.BibbidiTokenProperties;
import com.bibbidi.wedding.auth.config.properties.SecurityProperties;
import com.bibbidi.wedding.auth.security.ActiveUserAuthorizationManager;
import com.bibbidi.wedding.auth.security.AuthenticatedUser;
import com.bibbidi.wedding.auth.security.AuthenticationFailureResponseWriter;
import com.bibbidi.wedding.auth.security.BibbidiTokenAuthenticationFilter;
import com.bibbidi.wedding.auth.token.BibbidiTokenParser;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.security.autoconfigure.web.servlet.PathRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.ExceptionHandlingConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer.FrameOptionsConfig;
import org.springframework.security.config.annotation.web.configurers.RequestCacheConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(SecurityProperties.class)
public class SecurityConfig {

    private final BibbidiTokenParser bibbidiTokenParser;
    private final AuthenticationFailureResponseWriter failureResponseWriter;
    private final SecurityProperties securityProperties;
    private final BibbidiTokenProperties bibbidiTokenProperties;

    public SecurityConfig(
            BibbidiTokenParser bibbidiTokenParser,
            AuthenticationFailureResponseWriter failureResponseWriter,
            SecurityProperties securityProperties,
            BibbidiTokenProperties bibbidiTokenProperties
    ) {
        this.bibbidiTokenParser = bibbidiTokenParser;
        this.failureResponseWriter = failureResponseWriter;
        this.securityProperties = securityProperties;
        this.bibbidiTokenProperties = bibbidiTokenProperties;
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new RequestAttributeSecurityContextRepository();
    }

    @Bean
    public BibbidiTokenAuthenticationFilter bibbidiTokenAuthenticationFilter() {
        return new BibbidiTokenAuthenticationFilter(
                bibbidiTokenParser,
                failureResponseWriter,
                bibbidiTokenProperties,
                securityContextRepository()
        );
    }

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    @ConditionalOnBooleanProperty("spring.h2.console.enabled")
    public SecurityFilterChain h2ConsoleSecurityFilterChain(HttpSecurity http) {
        return http
                .securityMatcher(PathRequest.toH2Console())
                .csrf(AbstractHttpConfigurer::disable)
                .headers(headers -> headers.frameOptions(FrameOptionsConfig::sameOrigin))
                .authorizeHttpRequests(requests -> requests.anyRequest().permitAll())
                .build();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) {
        final String termsAgreementPath = "/api/users/me/terms-agreement";
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(RequestCacheConfigurer::disable)
                .anonymous(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .securityContext(context -> context.securityContextRepository(securityContextRepository()))
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(securityProperties.permitPendingUserPatterns()).authenticated()
                        .requestMatchers(securityProperties.permitAllPatterns()).permitAll()
                        .requestMatchers(termsAgreementPath).authenticated()
                        .anyRequest().access(new ActiveUserAuthorizationManager()))
                .addFilterBefore(bibbidiTokenAuthenticationFilter(), AuthorizationFilter.class)
                .exceptionHandling(this::configureExceptionHandling)
                .build();
    }

    private void configureExceptionHandling(ExceptionHandlingConfigurer<HttpSecurity> handling) {
        handling.authenticationEntryPoint(this::writeAuthenticationFailure);
        handling.accessDeniedHandler(this::writeAccessDenied);
    }

    private void writeAuthenticationFailure(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception
    ) throws IOException {
        writeAuthenticationRequired(request, response);
    }

    private void writeAuthenticationRequired(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        failureResponseWriter.write(
                request,
                response,
                ClientError.AUTHENTICATION_REQUIRED,
                "인증이 필요한 요청에 유효한 access token이 없습니다."
        );
    }

    private void writeAccessDenied(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException exception
    ) throws IOException {
        if (!hasAuthenticatedUser()) {
            writeAuthenticationRequired(request, response);
            return;
        }
        failureResponseWriter.write(
                request,
                response,
                ClientError.TERMS_AGREEMENT_REQUIRED,
                "약관에 동의하지 않은 사용자의 요청입니다."
        );
    }

    private boolean hasAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getPrincipal() instanceof AuthenticatedUser;
    }
}
