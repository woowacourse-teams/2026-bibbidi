package com.bibbidi.wedding.auth.oidc.jwks;

import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.client.JwksFetchClient;
import com.bibbidi.wedding.auth.oidc.provider.OidcProviderProperties;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 제공자별 서명 공개키를 담아 둔다.
 *
 * <p>제공자가 키를 바꾸면 모르는 kid가 들어온다. 그때만 한 번 다시 받아 오되,
 * 아무 kid나 보내 재조회를 유발하지 못하도록 제공자별로 최소 간격을 둔다.
 */
@Slf4j
@Component
public class JwksPublicKeyCache {

    private final JwksFetchClient jwksFetchClient;
    private final OidcProviderProperties providerProperties;
    private final JwksCacheProperties cacheProperties;
    private final Cache<SocialProvider, JsonWebKeySet> cache;
    private final Map<SocialProvider, Instant> lastForcedRefreshAt = new ConcurrentHashMap<>();

    public JwksPublicKeyCache(
            JwksFetchClient jwksFetchClient,
            OidcProviderProperties providerProperties,
            JwksCacheProperties cacheProperties
    ) {
        this.jwksFetchClient = jwksFetchClient;
        this.providerProperties = providerProperties;
        this.cacheProperties = cacheProperties;
        this.cache = Caffeine.newBuilder()
                .expireAfterWrite(cacheProperties.ttl())
                .maximumSize(cacheProperties.maximumSize())
                .build();
    }

    public JsonWebKey findKey(SocialProvider provider, String keyId) {
        JsonWebKeySet keySet = cache.get(provider, this::load);
        JsonWebKey key = select(keySet, keyId);
        if (key != null) {
            return key;
        }

        JsonWebKey refreshed = select(refreshIfAllowed(provider), keyId);
        if (refreshed == null) {
            throw new BusinessException(ClientError.SOCIAL_AUTHENTICATION_FAILED,
                    "제공자의 서명 공개키에서 kid를 찾지 못했습니다. provider=" + provider + " kid=" + keyId);
        }
        return refreshed;
    }

    /** 미리 받아 둔다. 로그인 첫 요청이 외부 호출을 기다리지 않게 한다. */
    public void refresh(SocialProvider provider) {
        cache.put(provider, load(provider));
    }

    private JsonWebKeySet refreshIfAllowed(SocialProvider provider) {
        Instant now = Instant.now();
        Instant lastRefreshedAt = lastForcedRefreshAt.get(provider);
        if (lastRefreshedAt != null
                && lastRefreshedAt.plus(cacheProperties.forcedRefreshMinInterval()).isAfter(now)) {
            log.warn("서명 공개키 재조회를 건너뜁니다. 최소 간격 안입니다. provider={}", provider);
            return cache.getIfPresent(provider);
        }

        lastForcedRefreshAt.put(provider, now);
        JsonWebKeySet keySet = load(provider);
        cache.put(provider, keySet);
        return keySet;
    }

    private JsonWebKeySet load(SocialProvider provider) {
        return jwksFetchClient.fetch(providerProperties.get(provider).jwksUri());
    }

    private static JsonWebKey select(JsonWebKeySet keySet, String keyId) {
        if (keySet == null) {
            return null;
        }
        return keySet.keys().stream()
                .filter(key -> keyId.equals(key.kid()))
                .findFirst()
                .orElse(null);
    }
}
