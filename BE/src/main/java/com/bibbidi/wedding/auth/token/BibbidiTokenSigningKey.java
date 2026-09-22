package com.bibbidi.wedding.auth.token;

import com.bibbidi.wedding.auth.config.BibbidiTokenProperties;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

@Component
public class BibbidiTokenSigningKey {

    private static final int MINIMUM_SECRET_BYTES = 32;

    private final SecretKey signingKey;

    public BibbidiTokenSigningKey(BibbidiTokenProperties properties) {
        byte[] secret = secretBytes(properties.secret());
        this.signingKey = Keys.hmacShaKeyFor(secret);
    }

    public SecretKey signingKey() {
        return signingKey;
    }

    private static byte[] secretBytes(String secret) {
        validateSecretNotNull(secret);

        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        validateSecretLength(bytes);

        return bytes;
    }

    private static void validateSecretLength(byte[] bytes) {
        if (bytes.length < MINIMUM_SECRET_BYTES) {
            throw new IllegalStateException(
                    "auth.jwt.secret이 너무 짧습니다. " + MINIMUM_SECRET_BYTES + "바이트 이상이어야 합니다.");
        }
    }

    private static void validateSecretNotNull(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("auth.jwt.secret이 비어 있습니다. 환경 변수로 주입해야 합니다.");
        }
    }
}
