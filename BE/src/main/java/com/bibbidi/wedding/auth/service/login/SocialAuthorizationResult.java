package com.bibbidi.wedding.auth.service.login;

/**
 * 사용자를 보낼 인가 화면 주소다.
 *
 * @param authorizationUri 이 주소로 보내면 소셜 로그인 화면이 열린다
 * @param state 돌아올 때 함께 오는 값. 클라이언트는 그대로 돌려주기만 한다
 */
public record SocialAuthorizationResult(String authorizationUri, String state) {
}
