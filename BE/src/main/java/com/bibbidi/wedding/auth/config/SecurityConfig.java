package com.bibbidi.wedding.auth.config;

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
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.ExceptionHandlingConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer.FrameOptionsConfig;
import org.springframework.security.config.annotation.web.configurers.RequestCacheConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

/**
 * 인증은 access token 하나로만 한다. 서버 세션을 만들지 않는다. CORS 헤더는 앞단 nginx가 붙이므로 여기서 켜지 않는다. 켜면 헤더가 겹친다.
 */
@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(SecurityProperties.class)
public class SecurityConfig {

    /**
     * 약관에 동의하기 전 사용자가 유일하게 부를 수 있는 경로다.
     */
    private static final String TERMS_AGREEMENT_PATH = "/api/users/me/terms-agreement";

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

    /**
     * H2 콘솔을 켠 dev 서버에서만 만들어진다. 콘솔 화면이 frame으로 이뤄져 있어서 같은 도메인의 frame은 허용한다.
     */
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
                        .requestMatchers(TERMS_AGREEMENT_PATH).authenticated()
                        .anyRequest().access(new ActiveUserAuthorizationManager()))
                // 인가를 판단하는 필터가 우리 인증 결과를 보게 그 앞에 둔다.
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
