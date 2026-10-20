package com.bibbidi.wedding.auth.oidc.verification;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class IdTokenHeaderReader {

    private static final String KEY_ID = "kid";
    private static final String ALGORITHM = "alg";

    private final ObjectMapper objectMapper;

    public IdTokenHeaderReader(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public IdTokenHeader read(String idToken) {
        JsonNode header = decodeHeader(idToken);
        JsonNode keyId = header.get(KEY_ID);
        JsonNode algorithm = header.get(ALGORITHM);
        if (keyId == null || algorithm == null) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "id_token 헤더에 kid 또는 alg가 없습니다."
            );
        }
        return new IdTokenHeader(keyId.asString(), algorithm.asString());
    }

    private JsonNode decodeHeader(String idToken) {
        String[] parts = idToken.split("\\.");
        if (parts.length < 2) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "id_token 형식이 올바르지 않습니다."
            );
        }
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(parts[0]);
            return objectMapper.readTree(new String(decoded, StandardCharsets.UTF_8));
        } catch (RuntimeException exception) {
            throw new BusinessException(
                    ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "id_token 헤더를 해석하지 못했습니다.",
                    exception
            );
        }
    }

    public record IdTokenHeader(String keyId, String algorithm) {
    }
}
