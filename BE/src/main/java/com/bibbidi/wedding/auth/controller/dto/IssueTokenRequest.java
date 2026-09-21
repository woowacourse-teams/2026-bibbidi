package com.bibbidi.wedding.auth.controller.dto;

import jakarta.validation.constraints.NotBlank;

public record IssueTokenRequest(@NotBlank(message = "닉네임을 입력해 주세요.") String nickname, @NotBlank(message = "비밀번호를 입력해 주세요.") String password) {
}
