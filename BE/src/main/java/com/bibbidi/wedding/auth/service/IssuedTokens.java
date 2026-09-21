package com.bibbidi.wedding.auth.service;

import java.time.Duration;

public record IssuedTokens(String accessToken, String refreshToken, Duration refreshTokenTtl) {
}
