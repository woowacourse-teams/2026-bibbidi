package com.bibbidi.wedding.auth.domain;

import org.jspecify.annotations.Nullable;

/** 어떤 소셜 계정이 어떤 회원인지 잇는다. */
public record SocialIdentity(
        @Nullable Long id,
        Long userId,
        SocialProvider provider,
        String providerUserId
) {

    public static SocialIdentity link(Long userId, SocialProvider provider, String providerUserId) {
        return new SocialIdentity(null, userId, provider, providerUserId);
    }
}
