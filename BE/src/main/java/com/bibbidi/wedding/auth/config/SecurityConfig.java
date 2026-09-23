package com.bibbidi.wedding.auth.config;

import com.bibbidi.wedding.auth.security.AuthenticatedUser;
import com.bibbidi.wedding.auth.security.AuthenticationFailureResponseWriter;
import com.bibbidi.wedding.auth.security.BibbidiTokenAuthenticationFilter;
import com.bibbidi.wedding.auth.token.BibbidiTokenParser;
import com.bibbidi.wedding.common.exception.ClientError;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.RequestCacheConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;

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

    /**
     * 약관에 동의해 가입을 끝낸 회원만 통과시킨다.
     *
     * <p>가입 상태를 권한 이름으로 바꿔 쓰지 않는다. 권한은 무엇을 할 수 있는지를 가르는 축이고,
     * 가입 상태는 서비스를 쓸 준비가 됐는지를 가르는 다른 축이기 때문이다.
     */
    private static AuthorizationManager<RequestAuthorizationContext> activeUser() {
        return (authentication, context) -> {
            Authentication current = authentication.get();
            if (current == null || !current.isAuthenticated()) {
                return new AuthorizationDecision(false);
            }
            return new AuthorizationDecision(
                    current.getPrincipal() instanceof AuthenticatedUser user && user.isActive());
        };
    }

    @Bean
    public BibbidiTokenAuthenticationFilter bibbidiTokenAuthenticationFilter() {
        return new BibbidiTokenAuthenticationFilter(
                bibbidiTokenParser,
                failureResponseWriter,
                bibbidiTokenProperties
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
                        .requestMatchers(securityProperties.permitPendingUserPatterns()).authenticated()
                        .requestMatchers(securityProperties.permitAllPatterns()).permitAll()
                        .requestMatchers(TERMS_AGREEMENT_PATH).authenticated()
                        .anyRequest().access(activeUser()))
                // 인가를 판단하는 필터가 우리 인증 결과를 보게 그 앞에 둔다.
                .addFilterBefore(bibbidiTokenAuthenticationFilter(), AuthorizationFilter.class)
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint(
                                (
                                        request, response, exception) -> failureResponseWriter.write(
                                        request,
                                        response,
                                        ClientError.AUTHENTICATION_REQUIRED,
                                        "인증이 필요한 요청에 유효한 access token이 없습니다."
                                )
                        )
                        .accessDeniedHandler(
                                (request, response, exception) -> failureResponseWriter.write(
                                        request,
                                        response,
                                        ClientError.TERMS_AGREEMENT_REQUIRED,
                                        "약관에 동의하지 않은 사용자의 요청입니다."
                                )
                        )
                ).build();
    }
}
