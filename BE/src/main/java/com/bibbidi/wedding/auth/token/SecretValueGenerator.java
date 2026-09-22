package com.bibbidi.wedding.auth.token;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

@Component
public class SecretValueGenerator {

    private static final int SECRET_BYTES = 32;
    private static final String SHA_256 = "SHA-256";

    private final SecureRandom secureRandom = new SecureRandom();

    public String generate() {
        byte[] bytes = new byte[SECRET_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String toSha256Hex(String value) {
        return HexFormat.of().formatHex(sha256(value));
    }

    public String toCodeChallenge(String codeVerifier) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(sha256(codeVerifier));
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance(SHA_256).digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(SHA_256 + "을 사용할 수 없습니다.", exception);
        }
    }
}
