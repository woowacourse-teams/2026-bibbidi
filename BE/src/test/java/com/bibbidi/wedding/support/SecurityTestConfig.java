package com.bibbidi.wedding.support;

import static org.mockito.Mockito.mock;

import com.bibbidi.wedding.auth.security.ActiveUserAuthorizationManager;
import com.bibbidi.wedding.auth.security.AuthenticationFailureResponseWriter;
import com.bibbidi.wedding.auth.security.SecurityConfig;
import com.bibbidi.wedding.auth.security.SecurityProperties;
import com.bibbidi.wedding.auth.token.AccessTokenParser;
import com.bibbidi.wedding.auth.token.JwtProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.ObjectMapper;

/**
 * 컨트롤러만 띄우는 테스트에도 실제 인가 규칙을 태운다.
 * 토큰 해석기는 대역을 쓴다. 여기서 확인하려는 것은 토큰 형식이 아니라 인가 규칙이기 때문이다.
 */
@TestConfiguration
@Import(SecurityConfig.class)
@EnableConfigurationProperties({SecurityProperties.class, JwtProperties.class})
public class SecurityTestConfig {

    @Bean
    public ActiveUserAuthorizationManager activeUserAuthorizationManager() {
        return new ActiveUserAuthorizationManager();
    }

    @Bean
    public AccessTokenParser accessTokenParser() {
        return mock(AccessTokenParser.class);
    }

    @Bean
    public AuthenticationFailureResponseWriter authenticationFailureResponseWriter(ObjectMapper objectMapper) {
        return new AuthenticationFailureResponseWriter(objectMapper);
    }
}
