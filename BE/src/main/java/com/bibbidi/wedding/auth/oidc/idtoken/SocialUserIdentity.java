package com.bibbidi.wedding.auth.oidc.idtoken;

import com.bibbidi.wedding.auth.domain.SocialProvider;
import org.jspecify.annotations.Nullable;

/**
 * id_token 검증을 마치고 확인한 사용자다.
 *
 * @param provider 어느 제공자가 보증했는지
 * @param providerUserId 제공자가 주는 사용자 식별자. 받은 문자열을 그대로 쓴다
 * @param nickname 제공자가 준 닉네임
 * @param email 제공자가 준 이메일. 회원 식별이나 계정 병합에는 쓰지 않는다
 */
public record SocialUserIdentity(
        SocialProvider provider,
        String providerUserId,
        @Nullable String nickname,
        @Nullable String email
) {
}
