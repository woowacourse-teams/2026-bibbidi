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

/** 제공자가 공개한 값에서 검증용 공개키를 만든다. */
@Component
public class RsaPublicKeyFactory {

    private static final String RSA = "RSA";

    public PublicKey create(JsonWebKey key) {
        try {
            BigInteger modulus = new BigInteger(1, Base64.getUrlDecoder().decode(key.n()));
            BigInteger exponent = new BigInteger(1, Base64.getUrlDecoder().decode(key.e()));
            return KeyFactory.getInstance(RSA).generatePublic(new RSAPublicKeySpec(modulus, exponent));
        } catch (GeneralSecurityException | RuntimeException exception) {
            throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "서명 공개키를 만들지 못했습니다. kid=" + key.kid(), exception);
        }
    }
}
