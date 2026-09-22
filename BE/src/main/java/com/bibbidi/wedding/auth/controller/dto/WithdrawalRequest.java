package com.bibbidi.wedding.auth.controller.dto;

import jakarta.validation.constraints.NotBlank;

/** @param deleteGrant 소셜 재인증으로 받은 탈퇴용 표 */
public record WithdrawalRequest(@NotBlank String deleteGrant) {
}
