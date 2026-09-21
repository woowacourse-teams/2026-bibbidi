package com.bibbidi.wedding.auth.controller.dto;

import com.bibbidi.wedding.auth.service.IssuedTokens;

public record AccessTokenResponse(String accessToken) {

    public static AccessTokenResponse from(IssuedTokens issuedTokens) {
        return new AccessTokenResponse(issuedTokens.accessToken());
    }
}
