package com.bibbidi.wedding.auth.oidc.idtoken;

import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.jwks.JwksPublicKeyCache;
import com.bibbidi.wedding.auth.oidc.jwks.RsaPublicKeyFactory;
import com.bibbidi.wedding.auth.oidc.provider.OidcProviderProperties;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import java.security.PublicKey;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * 제공자가 준 id_token을 검증한다.
 * 서명을 먼저 확인하고, 그 다음 발급자·대상·nonce를 확인한다. 만료는 서명 검증 단계에서 함께 걸러진다.
 */
@Component
public class IdTokenVerifier {

    private static final String NONCE = "nonce";

    private final OidcProviderProperties providerProperties;
    private final JwksPublicKeyCache jwksPublicKeyCache;
    private final IdTokenHeaderReader headerReader;
    private final RsaPublicKeyFactory publicKeyFactory;

    public IdTokenVerifier(
            OidcProviderProperties providerProperties,
            JwksPublicKeyCache jwksPublicKeyCache,
            IdTokenHeaderReader headerReader,
            RsaPublicKeyFactory publicKeyFactory
    ) {
        this.providerProperties = providerProperties;
        this.jwksPublicKeyCache = jwksPublicKeyCache;
        this.headerReader = headerReader;
        this.publicKeyFactory = publicKeyFactory;
    }

    public SocialUserIdentity verify(SocialProvider provider, String idToken, String expectedNonce) {
        OidcProviderProperties.Provider configuration = providerProperties.get(provider);
        IdTokenHeaderReader.IdTokenHeader header = headerReader.read(idToken);
        validateAlgorithm(configuration, header.algorithm());

        PublicKey publicKey = publicKeyFactory.create(
                jwksPublicKeyCache.findKey(provider, header.keyId()));
        Claims claims = parseSigned(idToken, publicKey);

        validateIssuer(configuration, claims);
        validateAudience(configuration, claims);
        validateNonce(claims, expectedNonce);

        return new SocialUserIdentity(
                provider,
                subject(claims),
                claims.get(configuration.nicknameClaim(), String.class),
                claims.get(configuration.emailClaim(), String.class));
    }

    private static void validateAlgorithm(OidcProviderProperties.Provider configuration, String algorithm) {
        if (!configuration.allowedAlgorithms().contains(algorithm)) {
            throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "허용하지 않는 서명 알고리즘입니다. alg=" + algorithm);
        }
    }

    private static Claims parseSigned(String idToken, PublicKey publicKey) {
        try {
            return Jwts.parser()
                    .verifyWith(publicKey)
                    .build()
                    .parseSignedClaims(idToken)
                    .getPayload();
        } catch (ExpiredJwtException exception) {
            throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "만료된 id_token입니다.", exception);
        } catch (JwtException | IllegalArgumentException exception) {
            throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "id_token 서명을 검증하지 못했습니다.", exception);
        }
    }

    private static void validateIssuer(OidcProviderProperties.Provider configuration, Claims claims) {
        if (!configuration.issuers().contains(claims.getIssuer())) {
            throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "허용하지 않는 발급자입니다. iss=" + claims.getIssuer());
        }
    }

    private static void validateAudience(OidcProviderProperties.Provider configuration, Claims claims) {
        Set<String> audiences = claims.getAudience();
        if (audiences == null || configuration.audiences().stream().noneMatch(audiences::contains)) {
            throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "허용하지 않는 대상입니다. aud=" + audiences);
        }
    }

    private static void validateNonce(Claims claims, String expectedNonce) {
        String nonce = claims.get(NONCE, String.class);
        if (nonce == null || !nonce.equals(expectedNonce)) {
            throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "id_token의 nonce가 우리가 만든 값과 다릅니다.");
        }
    }

    private static String subject(Claims claims) {
        String subject = claims.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "id_token에 사용자 식별자가 없습니다.");
        }
        return subject;
    }
}
