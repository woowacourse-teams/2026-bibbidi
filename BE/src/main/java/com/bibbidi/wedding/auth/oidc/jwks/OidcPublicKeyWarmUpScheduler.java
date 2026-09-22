package com.bibbidi.wedding.auth.oidc.jwks;

import com.bibbidi.wedding.auth.config.OidcProviderProperties;
import com.bibbidi.wedding.auth.config.OidcPublicKeyCacheProperties;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class OidcPublicKeyWarmUpScheduler {

    private final OidcPublicKeyCache oidcPublicKeyCache;
    private final OidcProviderProperties providerProperties;
    private final OidcPublicKeyCacheProperties cacheProperties;

    public OidcPublicKeyWarmUpScheduler(
            OidcPublicKeyCache oidcPublicKeyCache,
            OidcProviderProperties providerProperties,
            OidcPublicKeyCacheProperties cacheProperties
    ) {
        this.oidcPublicKeyCache = oidcPublicKeyCache;
        this.providerProperties = providerProperties;
        this.cacheProperties = cacheProperties;
    }

    @PostConstruct
    public void warmUpOnStartUp() {
        warmUp();
    }

    @Scheduled(fixedDelayString = "${auth.oidc-public-key.scheduled-refresh-interval}")
    public void warmUpPeriodically() {
        warmUp();
    }

    private void warmUp() {
        if (!cacheProperties.scheduledRefreshEnabled()) {
            return;
        }
        for (SocialProvider provider : providerProperties.configuredProviders()) {
            try {
                oidcPublicKeyCache.refresh(provider);
            } catch (RuntimeException exception) {
                log.warn("서명 공개키를 미리 받아 두지 못했습니다. provider={}", provider, exception);
            }
        }
    }
}
