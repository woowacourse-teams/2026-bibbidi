package com.bibbidi.wedding.user.controller.dto;

import com.bibbidi.wedding.auth.password.ValidPassword;
import jakarta.validation.constraints.NotBlank;

public record ChangePasswordRequest(
        @NotBlank(message = "현재 비밀번호는 비어 있을 수 없습니다.")
        String currentPassword,

        @ValidPassword
        String newPassword
) {
}
