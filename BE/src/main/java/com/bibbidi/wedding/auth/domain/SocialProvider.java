package com.bibbidi.wedding.auth.domain;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.Arrays;
import java.util.Locale;

/**
 * 지원하는 소셜 로그인 제공자다.
 * 제공자별로 달라지는 값은 모두 설정에 두고, 이 enum은 설정을 찾는 열쇠로만 쓴다.
 */
public enum SocialProvider {
    KAKAO,
    GOOGLE;

    public static SocialProvider from(String value) {
        return Arrays.stream(values())
                .filter(provider -> provider.name().equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ClientError.UNSUPPORTED_SOCIAL_PROVIDER,
                        "지원하지 않는 소셜 제공자 요청: " + value));
    }

    public String configKey() {
        return name().toLowerCase(Locale.ROOT);
    }
}
