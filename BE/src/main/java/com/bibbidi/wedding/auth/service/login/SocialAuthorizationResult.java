package com.bibbidi.wedding.auth.service.login;

import org.jspecify.annotations.Nullable;

/**
 * 사용자를 보낼 인가 화면 주소다.
 *
 * @param authorizationUri 이 주소로 보내면 소셜 로그인 화면이 열린다
 * @param state 돌아올 때 함께 오는 값. 클라이언트는 그대로 돌려주기만 한다
 * @param browserBinder 인가를 시작한 브라우저에만 쿠키로 심어 둘 값.
 *                      쿠키를 쓰지 않는 네이티브 요청에는 없다
 */
public record SocialAuthorizationResult(
        String authorizationUri,
        String state,
        @Nullable String browserBinder
) {
}
