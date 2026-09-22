package com.bibbidi.wedding.auth.token;

import com.bibbidi.wedding.auth.config.BibbidiTokenProperties;
import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import org.springframework.stereotype.Component;

@Component
public class BibbidiTokenParser {

    private final BibbidiTokenProperties properties;
    private final BibbidiTokenSigningKey signingKey;
    private final SecretValueGenerator secretValueGenerator;

    public BibbidiTokenParser(
            BibbidiTokenProperties properties,
            BibbidiTokenSigningKey signingKey,
            SecretValueGenerator secretValueGenerator
    ) {
        this.properties = properties;
        this.signingKey = signingKey;
        this.secretValueGenerator = secretValueGenerator;
    }

    public String hashRefreshToken(String refreshToken) {
        return secretValueGenerator.toSha256Hex(refreshToken);
    }

    public BibbidiTokenClaims parseAccessToken(String token) {
        Claims claims = parse(token, TokenCategory.ACCESS, ClientError.ACCESS_TOKEN_INVALID);
        return new BibbidiTokenClaims(
                userId(claims, ClientError.ACCESS_TOKEN_INVALID),
                parseEnumClaim(
                        claims,
                        BibbidiTokenClaimNames.STATUS,
                        UserStatus.class,
                        "status"),
                parseEnumClaim(
                        claims,
                        BibbidiTokenClaimNames.ROLE,
                        UserRole.class,
                        "role"),
                claims.get(BibbidiTokenClaimNames.NICKNAME, String.class),
                claims.get(BibbidiTokenClaimNames.EMAIL, String.class));
    }

    public Long parseDeleteGrantToken(String token) {
        Claims claims = parse(token, TokenCategory.DELETE_GRANT, ClientError.DELETE_GRANT_INVALID);
        return userId(claims, ClientError.DELETE_GRANT_INVALID);
    }

    private Claims parse(String token, TokenCategory expected, ClientError invalidError) {
        Claims claims = parseSigned(token, invalidError);
        String category = claims.get(BibbidiTokenClaimNames.CATEGORY, String.class);
        validateTokenCategory(expected, invalidError, category);
        return claims;
    }

    private void validateTokenCategory(TokenCategory expected, ClientError invalidError, String category) {
        if (!expected.name().equals(category)) {
            throw new BusinessException(
                    invalidError,
                    "토큰 용도가 다릅니다. 기대한 용도: " + expected.name()
            );
        }
    }

    private Claims parseSigned(String token, ClientError invalidError) {
        try {
            return Jwts.parser()
                    .verifyWith(signingKey.signingKey())
                    .requireIssuer(properties.issuer())
                    .requireAudience(properties.audience())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException exception) {
            throw new BusinessException(
                    ClientError.ACCESS_TOKEN_EXPIRED,
                    "만료된 토큰입니다.",
                    exception
            );
        } catch (JwtException | IllegalArgumentException exception) {
            throw new BusinessException(invalidError, "토큰을 검증하지 못했습니다.", exception);
        }
    }

    private static Long userId(Claims claims, ClientError invalidError) {
        try {
            return Long.valueOf(claims.getSubject());
        } catch (NumberFormatException | NullPointerException exception) {
            throw new BusinessException(invalidError,
                    "토큰의 sub가 사용자 식별자가 아닙니다.", exception);
        }
    }

    private static <E extends Enum<E>> E parseEnumClaim(
            Claims claims,
            String claimName,
            Class<E> enumType,
            String claimLabel
    ) {
        String value = claims.get(claimName, String.class);
        try {
            return Enum.valueOf(enumType, value);
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new BusinessException(
                    ClientError.ACCESS_TOKEN_INVALID,
                    "토큰의 " + claimLabel + " claim이 올바르지 않습니다.",
                    exception);
        }
    }
}
