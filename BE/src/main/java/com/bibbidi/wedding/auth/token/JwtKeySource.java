package com.bibbidi.wedding.auth.token;

import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class JwtKeySource {

    private static final String KEY_ALGORITHM = "RSA";
    private static final String RETIRED_KEY_SEPARATOR = ":";

    private final String activeKeyId;
    private final PrivateKey activePrivateKey;
    private final Map<String, PublicKey> publicKeysByKeyId;

    public JwtKeySource(JwtProperties jwtProperties) {
        this.activeKeyId = jwtProperties.activeKeyId();
        this.activePrivateKey = toPrivateKey(jwtProperties.activePrivateKey());
        this.publicKeysByKeyId = collectPublicKeys(jwtProperties);
    }

    public String activeKeyId() {
        return activeKeyId;
    }

    public PrivateKey activePrivateKey() {
        return activePrivateKey;
    }

    public Optional<PublicKey> findPublicKey(String keyId) {
        return Optional.ofNullable(publicKeysByKeyId.get(keyId));
    }

    private Map<String, PublicKey> collectPublicKeys(JwtProperties jwtProperties) {
        Map<String, PublicKey> publicKeys = new HashMap<>();
        publicKeys.put(activeKeyId, derivePublicKey(activePrivateKey));
        for (String retiredKey : jwtProperties.retiredPublicKeys()) {
            addRetiredPublicKey(publicKeys, retiredKey);
        }
        return publicKeys;
    }

    private void addRetiredPublicKey(Map<String, PublicKey> publicKeys, String retiredKey) {
        if (retiredKey.isBlank()) {
            return;
        }

        int separatorIndex = retiredKey.indexOf(RETIRED_KEY_SEPARATOR);
        if (separatorIndex <= 0) {
            throw new IllegalStateException("과거 검증 공개키는 kid:base64 형식이어야 합니다.");
        }

        String keyId = retiredKey.substring(0, separatorIndex);
        String encodedKey = retiredKey.substring(separatorIndex + 1);
        publicKeys.put(keyId, toPublicKey(encodedKey));
    }

    private PublicKey derivePublicKey(PrivateKey privateKey) {
        if (!(privateKey instanceof RSAPrivateCrtKey rsaPrivateKey)) {
            throw new IllegalStateException("서명 개인키에서 공개키를 얻을 수 없습니다.");
        }

        RSAPublicKeySpec publicKeySpec =
                new RSAPublicKeySpec(rsaPrivateKey.getModulus(), rsaPrivateKey.getPublicExponent());
        return generatePublicKey(publicKeySpec);
    }

    private PrivateKey toPrivateKey(String encodedKey) {
        try {
            byte[] decoded = Base64.getDecoder().decode(encodedKey);
            return keyFactory().generatePrivate(new PKCS8EncodedKeySpec(decoded));
        } catch (IllegalArgumentException | InvalidKeySpecException exception) {
            throw new IllegalStateException("서명 개인키를 읽을 수 없습니다.");
        }
    }

    private PublicKey toPublicKey(String encodedKey) {
        try {
            byte[] decoded = Base64.getDecoder().decode(encodedKey);
            return keyFactory().generatePublic(new X509EncodedKeySpec(decoded));
        } catch (IllegalArgumentException | InvalidKeySpecException exception) {
            throw new IllegalStateException("검증 공개키를 읽을 수 없습니다.");
        }
    }

    private PublicKey generatePublicKey(RSAPublicKeySpec publicKeySpec) {
        try {
            return keyFactory().generatePublic(publicKeySpec);
        } catch (InvalidKeySpecException exception) {
            throw new IllegalStateException("검증 공개키를 만들 수 없습니다.");
        }
    }

    private KeyFactory keyFactory() {
        try {
            return KeyFactory.getInstance(KEY_ALGORITHM);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("RSA 알고리즘을 사용할 수 없습니다.");
        }
    }
}
