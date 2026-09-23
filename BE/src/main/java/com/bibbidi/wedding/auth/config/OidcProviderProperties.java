package com.bibbidi.wedding.auth.config;

import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 제공자마다 달라지는 값은 전부 여기 설정으로만 존재한다.
 * 서비스 코드에는 제공자를 가르는 분기를 두지 않고, 이 설정을 찾아 쓰기만 한다.
 * 제공자를 하나 더 붙일 때 늘어나는 것은 yml뿐이어야 한다.
 *
 * @param providers 제공자 이름(소문자)별 설정
 */
@ConfigurationProperties(prefix = "auth.oidc")
public record OidcProviderProperties(Map<String, Provider> providers) {

    public Provider get(SocialProvider provider) {
        Provider found = providers.get(provider.configKey());
        if (found == null) {
            throw new BusinessException(
                    ClientError.UNSUPPORTED_SOCIAL_PROVIDER,
                    "설정에 없는 소셜 제공자입니다. provider=" + provider);
        }
        return found;
    }

    public boolean isConfigured(SocialProvider provider) {
        return providers.containsKey(provider.configKey());
    }

    public List<SocialProvider> configuredProviders() {
        return List.of(SocialProvider.values()).stream()
                .filter(this::isConfigured)
                .toList();
    }

    /**
     * @param clientId 제공자에 등록한 우리 앱 식별자
     * @param clientSecret 토큰 교환에 쓰는 비밀값
     * @param issuers id_token의 iss로 허용할 값. 구글처럼 두 가지를 쓰는 곳이 있다
     * @param audiences id_token의 aud로 허용할 값. 플랫폼마다 다른 client id를 쓰면 여러 개가 된다
     * @param allowedAlgorithms 허용할 서명 알고리즘
     * @param authorizationUri 인가 화면 주소
     * @param tokenUri 인가 코드를 토큰으로 바꾸는 주소
     * @param jwksUri 서명 공개키를 받는 주소
     * @param scopes 요청할 권한 범위
     * @param nicknameClaim 닉네임이 들어 있는 claim 이름
     * @param emailClaim 이메일이 들어 있는 claim 이름
     * @param redirectUris 클라이언트 종류별 redirect 주소
     */
    public record Provider(
            String clientId,
            String clientSecret,
            List<String> issuers,
            List<String> audiences,
            List<String> allowedAlgorithms,
            String authorizationUri,
            String tokenUri,
            String jwksUri,
            List<String> scopes,
            String nicknameClaim,
            String emailClaim,
            Map<String, String> redirectUris
    ) {
    }
}
