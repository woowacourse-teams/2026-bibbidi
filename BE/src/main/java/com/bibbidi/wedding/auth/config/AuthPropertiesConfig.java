package com.bibbidi.wedding.auth.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 인증 설정값을 빈으로 등록한다. 값은 모두 application.yaml과 환경 변수에서 온다.
 */
@Configuration
@EnableConfigurationProperties(
        {
                BibbidiTokenProperties.class,
                SessionProperties.class,
                AuthCleanupProperties.class,
                RefreshCookieProperties.class
        }
)
public class AuthPropertiesConfig {
}
