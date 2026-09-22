package com.bibbidi.wedding.auth.token;

import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

/**
 * 서명 비밀말을 HMAC 키로 바꾼다.
 * 비밀말이 없거나 HS256이 요구하는 256비트에 못 미치면 애플리케이션을 띄우지 않는다.
 */
@Component
public class JwtSigningKeySource {

    private static final int MINIMUM_SECRET_BYTES = 32;

    private final SecretKey signingKey;

    public JwtSigningKeySource(JwtProperties properties) {
        byte[] secret = secretBytes(properties.secret());
        this.signingKey = Keys.hmacShaKeyFor(secret);
    }

    public SecretKey signingKey() {
        return signingKey;
    }

    private static byte[] secretBytes(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("auth.jwt.secret이 비어 있습니다. 환경 변수로 주입해야 합니다.");
        }
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < MINIMUM_SECRET_BYTES) {
            throw new IllegalStateException(
                    "auth.jwt.secret이 너무 짧습니다. " + MINIMUM_SECRET_BYTES + "바이트 이상이어야 합니다.");
        }
        return bytes;
    }
}
