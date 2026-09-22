package com.bibbidi.wedding.auth.controller.dto;

import com.bibbidi.wedding.auth.service.login.SocialAuthorizationResult;

/**
 * @param authorizationUri 이 주소로 사용자를 보내면 소셜 로그인 화면이 열린다
 * @param state 인가가 끝나고 돌아올 때 함께 오는 값. 그대로 다시 보내면 된다
 */
public record SocialAuthorizationResponse(String authorizationUri, String state) {

    public static SocialAuthorizationResponse from(SocialAuthorizationResult result) {
        return new SocialAuthorizationResponse(result.authorizationUri(), result.state());
    }
}
