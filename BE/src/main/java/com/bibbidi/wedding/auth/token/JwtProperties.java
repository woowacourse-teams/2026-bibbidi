package com.bibbidi.wedding.auth.token;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "bibbidi.jwt")
public record JwtProperties(
        String issuer,
        String audience,
        Duration accessTokenTtl,
        Duration refreshTokenTtl,
        String activeKeyId,
        String activePrivateKey,
        List<String> retiredPublicKeys
) {
}
