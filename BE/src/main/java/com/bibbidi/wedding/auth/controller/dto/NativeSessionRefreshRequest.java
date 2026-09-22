package com.bibbidi.wedding.auth.controller.dto;

import jakarta.validation.constraints.NotBlank;

/** 네이티브는 refresh token을 본문으로 보낸다. */
public record NativeSessionRefreshRequest(@NotBlank String refreshToken) {
}
