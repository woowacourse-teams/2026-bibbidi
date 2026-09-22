package com.bibbidi.wedding.auth.oidc.jwks;

import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.provider.OidcProviderProperties;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 서명 공개키를 미리 받아 둔다.
 * 캐시에 담아 두는 기간이 이 주기보다 길어, 받아 둔 키가 비는 순간이 생기지 않는다.
 */
@Slf4j
@Component
public class JwksCacheWarmUpScheduler {

    private final JwksPublicKeyCache jwksPublicKeyCache;
    private final OidcProviderProperties providerProperties;
    private final JwksCacheProperties cacheProperties;

    public JwksCacheWarmUpScheduler(
            JwksPublicKeyCache jwksPublicKeyCache,
            OidcProviderProperties providerProperties,
            JwksCacheProperties cacheProperties
    ) {
        this.jwksPublicKeyCache = jwksPublicKeyCache;
        this.providerProperties = providerProperties;
        this.cacheProperties = cacheProperties;
    }

    @PostConstruct
    public void warmUpOnStartUp() {
        warmUp();
    }

    @Scheduled(fixedDelayString = "${auth.oidc-jwks.refresh-interval}")
    public void warmUpPeriodically() {
        warmUp();
    }

    private void warmUp() {
        if (!cacheProperties.warmUpEnabled()) {
            return;
        }
        for (SocialProvider provider : providerProperties.configuredProviders()) {
            try {
                jwksPublicKeyCache.refresh(provider);
            } catch (RuntimeException exception) {
                log.warn("서명 공개키를 미리 받아 두지 못했습니다. provider={}", provider, exception);
            }
        }
    }
}
