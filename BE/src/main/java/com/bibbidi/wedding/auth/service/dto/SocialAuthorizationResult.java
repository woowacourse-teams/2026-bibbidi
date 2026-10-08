package com.bibbidi.wedding.auth.service.dto;

import org.jspecify.annotations.Nullable;

public record SocialAuthorizationResult(
        String authorizationUri,
        String state,
        @Nullable String browserBinder
) {
}
