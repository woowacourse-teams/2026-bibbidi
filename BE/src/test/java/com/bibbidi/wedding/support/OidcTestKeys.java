package com.bibbidi.wedding.support;

import com.bibbidi.wedding.auth.oidc.jwks.OidcPublicKey;
import io.jsonwebtoken.Jwts;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;

/**
 * 제공자를 실제로 부르지 않고 id_token을 만든다.
 * 키쌍을 진짜로 만들어 서명하므로 서명 검증 경로가 그대로 돌아간다.
 */
public final class OidcTestKeys {

    public static final String KEY_ID = "test-key-id";

    private static final KeyPair KEY_PAIR = generateKeyPair();

    private OidcTestKeys() {
    }

    public static OidcPublicKey publicKey() {
        RSAPublicKey publicKey = (RSAPublicKey) KEY_PAIR.getPublic();
        return new OidcPublicKey(
                KEY_ID,
                "RSA",
                "RS256",
                base64Url(publicKey.getModulus().toByteArray()),
                base64Url(publicKey.getPublicExponent().toByteArray()));
    }

    public static String idToken(String issuer, String audience, String subject, Map<String, ?> claims) {
        return idToken(issuer, audience, subject, claims, Instant.now().plusSeconds(300));
    }

    public static String idToken(
            String issuer,
            String audience,
            String subject,
            Map<String, ?> claims,
            Instant expiration
    ) {
        return Jwts.builder()
                .header().keyId(KEY_ID).and()
                .issuer(issuer)
                .audience().add(audience).and()
                .subject(subject)
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(expiration))
                .claims(claims)
                .signWith((RSAPrivateKey) KEY_PAIR.getPrivate(), Jwts.SIG.RS256)
                .compact();
    }

    private static String base64Url(byte[] value) {
        int offset = value.length > 1 && value[0] == 0 ? 1 : 0;
        byte[] trimmed = new byte[value.length - offset];
        System.arraycopy(value, offset, trimmed, 0, trimmed.length);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(trimmed);
    }

    private static KeyPair generateKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("테스트용 RSA 키쌍을 만들지 못했습니다.", exception);
        }
    }
}
