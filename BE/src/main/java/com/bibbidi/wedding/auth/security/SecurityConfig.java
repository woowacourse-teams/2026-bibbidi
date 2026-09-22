package com.bibbidi.wedding.auth.security;

import com.bibbidi.wedding.auth.token.AccessTokenParser;
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
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * 인증은 access token 하나로만 한다. 서버 세션을 만들지 않는다. CORS 헤더는 앞단 nginx가 붙이므로 여기서 켜지 않는다. 켜면 헤더가 겹친다.
 */
@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(SecurityProperties.class)
public class SecurityConfig {

    private final AccessTokenParser accessTokenParser;
    private final AuthenticationFailureResponseWriter failureResponseWriter;
    private final SecurityProperties securityProperties;
    private final JwtProperties jwtProperties;
    private final ActiveUserAuthorizationManager activeUserAuthorizationManager;

    public SecurityConfig(
            AccessTokenParser accessTokenParser,
            AuthenticationFailureResponseWriter failureResponseWriter,
            SecurityProperties securityProperties,
            JwtProperties jwtProperties,
            ActiveUserAuthorizationManager activeUserAuthorizationManager
    ) {
        this.accessTokenParser = accessTokenParser;
        this.failureResponseWriter = failureResponseWriter;
        this.securityProperties = securityProperties;
        this.jwtProperties = jwtProperties;
        this.activeUserAuthorizationManager = activeUserAuthorizationManager;
    }

    /**
     * 컴포넌트 스캔으로 등록하지 않는다. 등록하면 컨트롤러만 띄우는 슬라이스 테스트가 이 필터까지 끌어오면서 의존성을 찾지 못한다.
     */
    @Bean
    public AccessTokenAuthenticationFilter accessTokenAuthenticationFilter() {
        return new AccessTokenAuthenticationFilter(accessTokenParser, failureResponseWriter, jwtProperties);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
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
                        .requestMatchers(TermsAgreementPath.PATH).authenticated()
                        .anyRequest().access(activeUserAuthorizationManager))
                .addFilterBefore(accessTokenAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class)
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
