package com.bibbidi.wedding.auth.controller.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * @param code 제공자가 돌려준 인가 코드. 서버가 토큰으로 바꾼다
 * @param state 인가를 시작할 때 받은 값
 */
public record SocialLoginRequest(
        @NotBlank String code,
        @NotBlank String state
) {
}
