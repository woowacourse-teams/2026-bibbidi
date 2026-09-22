package com.bibbidi.wedding.auth.token;

import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import org.springframework.stereotype.Component;

/**
 * 서명 토큰을 검사해 값을 꺼낸다.
 * 서명과 만료는 jjwt가, 발급자·대상·용도는 여기서 확인한다.
 */
@Component
public class AccessTokenParser {

    private final JwtProperties properties;
    private final JwtSigningKeySource keySource;

    public AccessTokenParser(JwtProperties properties, JwtSigningKeySource keySource) {
        this.properties = properties;
        this.keySource = keySource;
    }

    public AccessTokenClaims parseAccessToken(String token) {
        Claims claims = parse(token, TokenCategory.ACCESS, ClientError.ACCESS_TOKEN_INVALID);
        return new AccessTokenClaims(
                userId(claims, ClientError.ACCESS_TOKEN_INVALID),
                status(claims),
                role(claims),
                claims.get(JwtClaimNames.NICKNAME, String.class),
                claims.get(JwtClaimNames.EMAIL, String.class));
    }

    /** 탈퇴 재인증 표를 검사하고 그 표가 가리키는 사용자를 돌려준다. */
    public Long parseDeleteGrant(String token) {
        Claims claims = parse(token, TokenCategory.DELETE_GRANT, ClientError.DELETE_GRANT_INVALID);
        return userId(claims, ClientError.DELETE_GRANT_INVALID);
    }

    private Claims parse(String token, TokenCategory expected, ClientError invalidError) {
        Claims claims = parseSigned(token, invalidError);
        String category = claims.get(JwtClaimNames.CATEGORY, String.class);
        if (!expected.name().equals(category)) {
            throw new BusinessException(invalidError,
                    "토큰 용도가 다릅니다. 기대한 용도: " + expected.name());
        }
        return claims;
    }

    private Claims parseSigned(String token, ClientError invalidError) {
        try {
            return Jwts.parser()
                    .verifyWith(keySource.signingKey())
                    .requireIssuer(properties.issuer())
                    .requireAudience(properties.audience())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException exception) {
            throw new BusinessException(ClientError.ACCESS_TOKEN_EXPIRED, "만료된 토큰입니다.", exception);
        } catch (JwtException | IllegalArgumentException exception) {
            throw new BusinessException(invalidError, "토큰을 검증하지 못했습니다.", exception);
        }
    }

    private static Long userId(Claims claims, ClientError invalidError) {
        try {
            return Long.valueOf(claims.getSubject());
        } catch (NumberFormatException | NullPointerException exception) {
            throw new BusinessException(invalidError, "토큰의 sub가 사용자 식별자가 아닙니다.", exception);
        }
    }

    private static UserRole role(Claims claims) {
        String role = claims.get(JwtClaimNames.ROLE, String.class);
        try {
            return UserRole.valueOf(role);
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new BusinessException(ClientError.ACCESS_TOKEN_INVALID,
                    "토큰의 role claim이 올바르지 않습니다.", exception);
        }
    }

    private static UserStatus status(Claims claims) {
        String status = claims.get(JwtClaimNames.STATUS, String.class);
        try {
            return UserStatus.valueOf(status);
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new BusinessException(ClientError.ACCESS_TOKEN_INVALID,
                    "토큰의 status claim이 올바르지 않습니다.", exception);
        }
    }
}
