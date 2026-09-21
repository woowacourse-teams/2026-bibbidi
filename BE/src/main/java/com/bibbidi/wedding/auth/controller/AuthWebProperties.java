package com.bibbidi.wedding.auth.controller;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "bibbidi.auth.web")
public record AuthWebProperties(
        String refreshCookieName,
        String refreshCookiePath,
        boolean refreshCookieSecure,
        List<String> allowedOrigins
) {
}
