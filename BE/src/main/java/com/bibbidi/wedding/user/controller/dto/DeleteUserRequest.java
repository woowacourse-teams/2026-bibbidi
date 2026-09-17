package com.bibbidi.wedding.user.controller.dto;

import jakarta.validation.constraints.NotBlank;

public record DeleteUserRequest(
        @NotBlank(message = "비밀번호는 비어 있을 수 없습니다.")
        String password
) {
}
