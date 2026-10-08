package com.bibbidi.wedding.auth.controller.dto.request;

import jakarta.validation.constraints.NotBlank;

public record LegacyAccountTransferRequest(@NotBlank String nickname, @NotBlank String password) {
}
