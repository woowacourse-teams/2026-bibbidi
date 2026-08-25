package com.bibbidi.wedding.auth.controller.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank(message = "닉네임은 비어 있을 수 없습니다.")
        @Size(max = 10, message = "닉네임은 10자 이하여야 합니다.")
        String nickname,

        @NotBlank(message = "비밀번호는 비어 있을 수 없습니다.")
        @Size(min = 4, max = 20, message = "비밀번호는 4자 이상 20자 이하여야 합니다.")
        String password
) {
}
