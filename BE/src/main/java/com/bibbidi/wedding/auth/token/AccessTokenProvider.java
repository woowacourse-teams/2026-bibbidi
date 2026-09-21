package com.bibbidi.wedding.auth.token;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwsHeader;
import io.jsonwebtoken.LocatorAdapter;
import java.security.Key;
import java.time.Instant;
import java.util.Date;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class AccessTokenProvider {

    private static final String CATEGORY_CLAIM = "category";
    private static final String ALLOWED_ALGORITHM = "RS256";

    private final JwtProperties jwtProperties;
    private final JwtKeySource jwtKeySource;

    public AccessTokenProvider(JwtProperties jwtProperties, JwtKeySource jwtKeySource) {
        this.jwtProperties = jwtProperties;
        this.jwtKeySource = jwtKeySource;
    }

    public String issue(Long userId, Instant issuedAt) {
        Instant expiresAt = issuedAt.plus(jwtProperties.accessTokenTtl());
        return Jwts.builder()
                .header()
                .keyId(jwtKeySource.activeKeyId())
                .and()
                .issuer(jwtProperties.issuer())
                .audience()
                .add(jwtProperties.audience())
                .and()
                .subject(String.valueOf(userId))
                .claim(CATEGORY_CLAIM, TokenCategory.ACCESS.claimValue())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(jwtKeySource.activePrivateKey(), Jwts.SIG.RS256)
                .compact();
    }

    public Long parseUserId(String accessToken) {
        Claims claims = parseClaims(accessToken);
        if (claims.getExpiration() == null) {
            throw new BusinessException(ClientError.AUTHENTICATION_FAILED, "Access Token 에 만료 시각이 없습니다.");
        }
        verifyIssuer(claims.getIssuer());
        verifyAudience(claims.getAudience());
        verifyCategory(claims.get(CATEGORY_CLAIM, String.class));
        return toUserId(claims.getSubject());
    }

    private Claims parseClaims(String accessToken) {
        try {
            return Jwts.parser()
                    .keyLocator(new AllowedAlgorithmKeyLocator())
                    .build()
                    .parseSignedClaims(accessToken)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException exception) {
            throw new BusinessException(ClientError.AUTHENTICATION_FAILED, "Access Token 검증에 실패했습니다.");
        }
    }

    private void verifyIssuer(String issuer) {
        if (!jwtProperties.issuer().equals(issuer)) {
            throw new BusinessException(ClientError.AUTHENTICATION_FAILED, "Access Token 의 발급자가 다릅니다.");
        }
    }

    private void verifyAudience(Set<String> audience) {
        if (audience == null || !audience.contains(jwtProperties.audience())) {
            throw new BusinessException(ClientError.AUTHENTICATION_FAILED, "Access Token 의 대상자가 다릅니다.");
        }
    }

    private void verifyCategory(String category) {
        if (!TokenCategory.ACCESS.matches(category)) {
            throw new BusinessException(ClientError.AUTHENTICATION_FAILED, "Access Token 자리에 다른 용도의 토큰이 왔습니다.");
        }
    }

    private Long toUserId(String subject) {
        try {
            long userId = Long.parseLong(subject);
            if (userId <= 0) {
                throw new BusinessException(ClientError.AUTHENTICATION_FAILED, "Access Token 의 사용자 ID 가 양수가 아닙니다.");
            }
            return userId;
        } catch (NumberFormatException exception) {
            throw new BusinessException(ClientError.AUTHENTICATION_FAILED, "Access Token 의 사용자 ID 를 읽을 수 없습니다.");
        }
    }

    private class AllowedAlgorithmKeyLocator extends LocatorAdapter<Key> {

        @Override
        protected Key locate(JwsHeader header) {
            if (!ALLOWED_ALGORITHM.equals(header.getAlgorithm())) {
                throw new BusinessException(ClientError.AUTHENTICATION_FAILED, "허용하지 않는 서명 알고리즘입니다.");
            }

            return jwtKeySource.findPublicKey(header.getKeyId())
                    .orElseThrow(() -> new BusinessException(
                            ClientError.AUTHENTICATION_FAILED, "토큰에 적힌 서명 키를 찾을 수 없습니다."));
        }
    }
}
