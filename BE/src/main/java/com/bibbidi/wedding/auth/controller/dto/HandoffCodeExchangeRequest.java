package com.bibbidi.wedding.auth.controller.dto;

import jakarta.validation.constraints.NotBlank;

/** @param code 앱이 WebView에 넘겨 준 1회용 코드 */
public record HandoffCodeExchangeRequest(@NotBlank String code) {
}
