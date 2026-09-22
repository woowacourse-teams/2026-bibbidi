package com.bibbidi.wedding.auth.oidc.jwks;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.math.BigInteger;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import org.springframework.stereotype.Component;

@Component
public class RsaPublicKeyFactory {

    private static final String RSA = "RSA";

    public PublicKey create(OidcPublicKey key) {
        try {
            BigInteger modulus = new BigInteger(1, Base64.getUrlDecoder().decode(key.n()));
            BigInteger exponent = new BigInteger(1, Base64.getUrlDecoder().decode(key.e()));
            RSAPublicKeySpec keySpec = new RSAPublicKeySpec(modulus, exponent);
            return KeyFactory.getInstance(RSA).generatePublic(keySpec);
        } catch (GeneralSecurityException | RuntimeException exception) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "서명 공개키를 만들지 못했습니다. kid=" + key.kid(),
                    exception
            );
        }
    }
}
