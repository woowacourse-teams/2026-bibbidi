package com.bibbidi.wedding.auth.oidc.jwks;

import com.bibbidi.wedding.auth.config.OidcProviderProperties;
import com.bibbidi.wedding.auth.config.OidcPublicKeyCacheProperties;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.client.OidcPublicKeyFetchClient;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class OidcPublicKeyCache {

    private final OidcPublicKeyFetchClient oidcPublicKeyFetchClient;
    private final OidcProviderProperties providerProperties;
    private final OidcPublicKeyCacheProperties cacheProperties;
    private final Cache<SocialProvider, OidcPublicKeySet> cache;
    private final Map<SocialProvider, Instant> lastForcedRefreshAt = new ConcurrentHashMap<>();

    public OidcPublicKeyCache(
            OidcPublicKeyFetchClient oidcPublicKeyFetchClient,
            OidcProviderProperties providerProperties,
            OidcPublicKeyCacheProperties cacheProperties
    ) {
        this.oidcPublicKeyFetchClient = oidcPublicKeyFetchClient;
        this.providerProperties = providerProperties;
        this.cacheProperties = cacheProperties;
        this.cache = Caffeine.newBuilder()
                .expireAfterWrite(cacheProperties.cachedKeyLifetime())
                .maximumSize(cacheProperties.maxCachedProviderCount())
                .build();
    }

    public OidcPublicKey findKey(SocialProvider provider, String keyId) {
        OidcPublicKeySet keySet = cache.get(provider, this::load);
        OidcPublicKey key = select(keySet, keyId);
        if (key != null) {
            return key;
        }

        OidcPublicKey refreshed = select(refreshIfAllowed(provider), keyId);
        if (refreshed == null) {
            throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "제공자의 서명 공개키에서 kid를 찾지 못했습니다. provider=" + provider + " kid=" + keyId);
        }
        return refreshed;
    }

    public void refresh(SocialProvider provider) {
        cache.put(provider, load(provider));
    }

    private OidcPublicKeySet refreshIfAllowed(SocialProvider provider) {
        Instant now = Instant.now();
        Instant lastRefreshedAt = lastForcedRefreshAt.get(provider);
        if (lastRefreshedAt != null
                && lastRefreshedAt.plus(cacheProperties.unknownKeyRefreshMinInterval()).isAfter(now)) {
            log.warn("서명 공개키 재조회를 건너뜁니다. 최소 간격 안입니다. provider={}", provider);
            return cache.getIfPresent(provider);
        }

        lastForcedRefreshAt.put(provider, now);
        OidcPublicKeySet keySet = load(provider);
        cache.put(provider, keySet);
        return keySet;
    }

    private OidcPublicKeySet load(SocialProvider provider) {
        return oidcPublicKeyFetchClient.fetch(providerProperties.get(provider).jwksUri());
    }

    private static OidcPublicKey select(OidcPublicKeySet keySet, String keyId) {
        if (keySet == null) {
            return null;
        }
        return keySet.keys().stream()
                .filter(key -> keyId.equals(key.kid()))
                .findFirst()
                .orElse(null);
    }
}
