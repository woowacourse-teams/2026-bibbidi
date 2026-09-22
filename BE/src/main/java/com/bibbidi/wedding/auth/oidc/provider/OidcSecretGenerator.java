package com.bibbidi.wedding.auth.oidc.provider;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.springframework.stereotype.Component;

/** state, nonce, PKCE 값처럼 추측할 수 없어야 하는 값을 만든다. */
@Component
public class OidcSecretGenerator {

    private static final int SECRET_BYTES = 32;
    private static final String SHA_256 = "SHA-256";

    private final SecureRandom secureRandom = new SecureRandom();

    public String generate() {
        byte[] bytes = new byte[SECRET_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** PKCE에서 code_verifier를 넘겨줄 때 쓰는 변형값이다. */
    public String toCodeChallenge(String codeVerifier) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(sha256(codeVerifier));
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance(SHA_256).digest(value.getBytes(StandardCharsets.US_ASCII));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(SHA_256 + "을 사용할 수 없습니다.", exception);
        }
    }
}
