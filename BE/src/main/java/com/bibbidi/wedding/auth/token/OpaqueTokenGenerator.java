package com.bibbidi.wedding.auth.token;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

/**
 * 뜻을 담지 않는 1회용 값을 만들고, 저장할 해시를 계산한다.
 * refresh token과 handoff code처럼 훔치면 바로 쓰이는 값은 원문을 저장하지 않는다.
 */
@Component
public class OpaqueTokenGenerator {

    private static final int TOKEN_BYTES = 32;
    private static final String SHA_256 = "SHA-256";

    private final SecureRandom secureRandom = new SecureRandom();

    public String generate() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance(SHA_256)
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(SHA_256 + "을 사용할 수 없습니다.", exception);
        }
    }
}
