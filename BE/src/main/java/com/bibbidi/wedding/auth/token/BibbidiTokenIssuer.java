package com.bibbidi.wedding.auth.token;

import com.bibbidi.wedding.auth.config.BibbidiTokenProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.MacAlgorithm;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * 우리가 내주는 토큰을 만든다. 수명과 식별자는 모두 설정에서 온다.
 *
 * <p>access token과 탈퇴용 표는 서명한 JWT로, refresh token은 뜻을 담지 않는 난수로 만든다.
 * refresh token은 서명으로 검증하지 않고 저장해 둔 해시와 대조하므로, 값과 함께 저장할 해시를 준다. 저장은 이 자리의 일이 아니라 부르는 쪽이 한다.
 */
@Component
public class BibbidiTokenIssuer {

    private final BibbidiTokenProperties properties;
    private final BibbidiTokenSigningKey signingKey;
    private final SecretValueGenerator secretValueGenerator;

    public BibbidiTokenIssuer(
            BibbidiTokenProperties properties,
            BibbidiTokenSigningKey signingKey,
            SecretValueGenerator secretValueGenerator
    ) {
        this.properties = properties;
        this.signingKey = signingKey;
        this.secretValueGenerator = secretValueGenerator;
    }

    /**
     * refresh token은 뜻을 담지 않는 난수다. 서명할 내용이 없고, 폐기할 수 있어야 하므로 서버가 해시를 들고 대조한다.
     */
    public IssuedRefreshToken issueRefreshToken() {
        String value = secretValueGenerator.generate();
        return new IssuedRefreshToken(value, secretValueGenerator.toSha256Hex(value));
    }

    public String issueAccessToken(BibbidiTokenClaims claims) {
        Instant issuedAt = Instant.now();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .issuer(properties.issuer())
                .audience().add(properties.audience()).and()
                .subject(String.valueOf(claims.userId()))
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(issuedAt.plus(properties.accessTokenLifetime())))
                .claim(BibbidiTokenClaimNames.CATEGORY, TokenCategory.ACCESS.name())
                .claim(BibbidiTokenClaimNames.STATUS, claims.status().name())
                .claim(BibbidiTokenClaimNames.ROLE, claims.role().name())
                .claim(BibbidiTokenClaimNames.NICKNAME, claims.nickname())
                .claim(BibbidiTokenClaimNames.EMAIL, claims.email())
                .signWith(signingKey.signingKey(), signatureAlgorithm())
                .compact();
    }

    public String issueDeleteGrantToken(Long userId) {
        Instant issuedAt = Instant.now();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .issuer(properties.issuer())
                .audience().add(properties.audience()).and()
                .subject(String.valueOf(userId))
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(issuedAt.plus(properties.deleteGrantLifetime())))
                .claim(BibbidiTokenClaimNames.CATEGORY, TokenCategory.DELETE_GRANT.name())
                .signWith(signingKey.signingKey(), signatureAlgorithm())
                .compact();
    }

    public Duration accessTokenLifetime() {
        return properties.accessTokenLifetime();
    }

    private MacAlgorithm signatureAlgorithm() {
        return switch (properties.signatureAlgorithm()) {
            case "HS256" -> Jwts.SIG.HS256;
            case "HS384" -> Jwts.SIG.HS384;
            case "HS512" -> Jwts.SIG.HS512;
            default -> throw new IllegalStateException(
                    "지원하지 않는 JWT 서명 알고리즘입니다. alg=" + properties.signatureAlgorithm());
        };
    }
}
