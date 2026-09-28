package com.bibbidi.wedding.auth.oidc.verification;

import com.bibbidi.wedding.auth.config.OidcProviderProperties;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.jwks.OidcPublicKeyCache;
import com.bibbidi.wedding.auth.oidc.jwks.RsaPublicKeyFactory;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import java.security.PublicKey;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class IdTokenVerifier {

    private static final String NONCE = "nonce";

    private final OidcProviderProperties providerProperties;
    private final OidcPublicKeyCache oidcPublicKeyCache;
    private final IdTokenHeaderReader headerReader;
    private final RsaPublicKeyFactory publicKeyFactory;

    public IdTokenVerifier(
            OidcProviderProperties providerProperties,
            OidcPublicKeyCache oidcPublicKeyCache,
            IdTokenHeaderReader headerReader,
            RsaPublicKeyFactory publicKeyFactory
    ) {
        this.providerProperties = providerProperties;
        this.oidcPublicKeyCache = oidcPublicKeyCache;
        this.headerReader = headerReader;
        this.publicKeyFactory = publicKeyFactory;
    }

    public VerifiedOidcUser verify(SocialProvider provider, String idToken, String expectedNonce) {
        OidcProviderProperties.Provider configuration = providerProperties.get(provider);
        IdTokenHeaderReader.IdTokenHeader header = headerReader.read(idToken);
        validateAlgorithm(configuration, header.algorithm());

        PublicKey publicKey = publicKeyFactory.create(
                oidcPublicKeyCache.findKey(provider, header.keyId())
        );
        Claims claims = parseSigned(idToken, publicKey);

        validateIssuer(configuration, claims);
        validateAudience(configuration, claims);
        validateNonce(claims, expectedNonce);

        return new VerifiedOidcUser(
                provider,
                parseSubject(claims),
                stringClaim(claims, configuration.nicknameClaim(), "nickname"),
                stringClaim(claims, configuration.emailClaim(), "email")
        );
    }

    private void validateAlgorithm(OidcProviderProperties.Provider configuration, String algorithm) {
        if (!configuration.allowedAlgorithms().contains(algorithm)) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "허용하지 않는 서명 알고리즘입니다. alg=" + algorithm
            );
        }
    }

    private Claims parseSigned(String idToken, PublicKey publicKey) {
        try {
            return Jwts.parser()
                    .verifyWith(publicKey)
                    .build()
                    .parseSignedClaims(idToken)
                    .getPayload();
        } catch (ExpiredJwtException exception) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "만료된 id_token입니다.", exception
            );
        } catch (JwtException | IllegalArgumentException exception) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "id_token 서명을 검증하지 못했습니다.", exception
            );
        }
    }

    private void validateIssuer(OidcProviderProperties.Provider configuration, Claims claims) {
        String issuer = claims.getIssuer();
        if (!configuration.issuers().contains(issuer)) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "허용하지 않는 발급자입니다. iss=" + issuer
            );
        }
    }

    private void validateAudience(OidcProviderProperties.Provider configuration, Claims claims) {
        Set<String> audiences = claims.getAudience();
        if (audiences == null || configuration.audiences().stream().noneMatch(audiences::contains)) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "허용하지 않는 대상입니다. aud=" + audiences
            );
        }
    }

    private void validateNonce(Claims claims, String expectedNonce) {
        String nonce = stringClaim(claims, NONCE, "nonce");
        if (nonce == null || !nonce.equals(expectedNonce)) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "id_token의 nonce가 현재 서비스에서 만든 값과 다릅니다."
            );
        }
    }

    private String stringClaim(Claims claims, String claimName, String claimLabel) {
        try {
            return claims.get(claimName, String.class);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "id_token의 " + claimLabel + " claim 형식이 올바르지 않습니다.", exception);
        }
    }

    private String parseSubject(Claims claims) {
        String subject = claims.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "id_token에 사용자 식별자가 없습니다."
            );
        }
        return subject;
    }
}
