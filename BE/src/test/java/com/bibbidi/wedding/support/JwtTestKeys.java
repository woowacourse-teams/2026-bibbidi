package com.bibbidi.wedding.support;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.Base64;

public final class JwtTestKeys {

    public static final String ACTIVE_KEY_ID = "test-active-key";

    private static final String KEY_ALGORITHM = "RSA";
    private static final int KEY_SIZE = 2048;
    private static final KeyPair KEY_PAIR = generateKeyPair();

    private JwtTestKeys() {
    }

    public static PrivateKey privateKey() {
        return KEY_PAIR.getPrivate();
    }

    public static PublicKey publicKey() {
        return KEY_PAIR.getPublic();
    }

    public static String encodedPrivateKey() {
        return Base64.getEncoder().encodeToString(KEY_PAIR.getPrivate().getEncoded());
    }

    public static KeyPair generateAnotherKeyPair() {
        return generateKeyPair();
    }

    private static KeyPair generateKeyPair() {
        try {
            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance(KEY_ALGORITHM);
            keyPairGenerator.initialize(KEY_SIZE);
            return keyPairGenerator.generateKeyPair();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("테스트용 RSA 키 쌍을 만들 수 없습니다.", exception);
        }
    }
}
