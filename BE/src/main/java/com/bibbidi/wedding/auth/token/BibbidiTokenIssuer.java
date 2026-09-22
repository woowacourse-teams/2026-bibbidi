package com.bibbidi.wedding.auth.token;

import io.jsonwebtoken.Jwts;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** 서명 토큰을 발급한다. 수명과 식별자는 모두 설정에서 온다. */
@Component
public class BibbidiTokenIssuer {

    private final JwtProperties properties;
    private final JwtSigningKeySource keySource;

    public BibbidiTokenIssuer(JwtProperties properties, JwtSigningKeySource keySource) {
        this.properties = properties;
        this.keySource = keySource;
    }

    public String issueAccessToken(BibbidiTokenClaims claims) {
        Instant issuedAt = Instant.now();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .issuer(properties.issuer())
                .audience().add(properties.audience()).and()
                .subject(String.valueOf(claims.userId()))
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(issuedAt.plus(properties.accessTokenTtl())))
                .claim(JwtClaimNames.CATEGORY, TokenCategory.ACCESS.name())
                .claim(JwtClaimNames.STATUS, claims.status().name())
                .claim(JwtClaimNames.ROLE, claims.role().name())
                .claim(JwtClaimNames.NICKNAME, claims.nickname())
                .claim(JwtClaimNames.EMAIL, claims.email())
                .signWith(keySource.signingKey())
                .compact();
    }

    /** 탈퇴 전 소셜 재인증을 마쳤다는 표다. 사용자 식별과 만료만 담는다. */
    public String issueDeleteGrant(Long userId) {
        Instant issuedAt = Instant.now();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .issuer(properties.issuer())
                .audience().add(properties.audience()).and()
                .subject(String.valueOf(userId))
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(issuedAt.plus(properties.deleteGrantTtl())))
                .claim(JwtClaimNames.CATEGORY, TokenCategory.DELETE_GRANT.name())
                .signWith(keySource.signingKey())
                .compact();
    }

    public Duration accessTokenTtl() {
        return properties.accessTokenTtl();
    }
}
