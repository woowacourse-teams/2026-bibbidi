package com.bibbidi.wedding.auth.security;

import com.bibbidi.wedding.auth.token.BibbidiTokenParser;
import com.bibbidi.wedding.auth.token.JwtProperties;
import com.bibbidi.wedding.common.exception.ClientError;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.RequestCacheConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;

/**
 * 인증은 access token 하나로만 한다. 서버 세션을 만들지 않는다. CORS 헤더는 앞단 nginx가 붙이므로 여기서 켜지 않는다. 켜면 헤더가 겹친다.
 */
@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(SecurityProperties.class)
public class SecurityConfig {

    /** 약관에 동의하기 전 사용자가 유일하게 부를 수 있는 경로다. */
    private static final String TERMS_AGREEMENT_PATH = "/api/users/me/terms-agreement";

    private final BibbidiTokenParser bibbidiTokenParser;
    private final AuthenticationFailureResponseWriter failureResponseWriter;
    private final SecurityProperties securityProperties;
    private final JwtProperties jwtProperties;
    private final ActiveUserAuthorizationManager activeUserAuthorizationManager;

    public SecurityConfig(
            BibbidiTokenParser bibbidiTokenParser,
            AuthenticationFailureResponseWriter failureResponseWriter,
            SecurityProperties securityProperties,
            JwtProperties jwtProperties,
            ActiveUserAuthorizationManager activeUserAuthorizationManager
    ) {
        this.bibbidiTokenParser = bibbidiTokenParser;
        this.failureResponseWriter = failureResponseWriter;
        this.securityProperties = securityProperties;
        this.jwtProperties = jwtProperties;
        this.activeUserAuthorizationManager = activeUserAuthorizationManager;
    }

    @Bean
    public BibbidiTokenAuthenticationFilter bibbidiTokenAuthenticationFilter() {
        return new BibbidiTokenAuthenticationFilter(
                bibbidiTokenParser,
                failureResponseWriter,
                jwtProperties
        );
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
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(securityProperties.requireAuthenticationPatterns()).authenticated()
                        .requestMatchers(securityProperties.permitAllPatterns()).permitAll()
                        .requestMatchers(TERMS_AGREEMENT_PATH).authenticated()
                        .anyRequest().access(activeUserAuthorizationManager))
                // 인가를 판단하는 필터가 우리 인증 결과를 보게 그 앞에 둔다.
                .addFilterBefore(bibbidiTokenAuthenticationFilter(), AuthorizationFilter.class)
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint(
                                (
                                        request, response, exception) -> failureResponseWriter.respond(
                                        request,
                                        response,
                                        ClientError.AUTHENTICATION_REQUIRED,
                                        "인증이 필요한 요청에 유효한 access token이 없습니다."
                                )
                        )
                        .accessDeniedHandler(
                                (request, response, exception) -> failureResponseWriter.respond(
                                        request,
                                        response,
                                        ClientError.TERMS_AGREEMENT_REQUIRED,
                                        "약관에 동의하지 않은 사용자의 요청입니다."
                                )
                        )
                ).build();
    }
}
