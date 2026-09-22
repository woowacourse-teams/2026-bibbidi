package com.bibbidi.wedding.auth.oidc.verification;

import com.bibbidi.wedding.auth.domain.SocialProvider;
import org.jspecify.annotations.Nullable;

/**
 * id_token 검증을 모두 통과한 사용자다.
 *
 * <p>서명과 발급자, 대상, nonce를 확인한 뒤에만 만들어진다. 검증 전 값과 섞이지 않도록 따로 둔다.
 * 제공자의 UserInfo 엔드포인트를 부르지 않고 id_token의 claim에서 가져온다.
 *
 * @param provider 어느 제공자가 보증했는지
 * @param providerUserId 제공자가 주는 사용자 식별자. 받은 문자열을 그대로 쓴다
 * @param nickname 제공자가 준 닉네임
 * @param email 제공자가 준 이메일. 회원 식별이나 계정 병합에는 쓰지 않는다
 */
public record VerifiedOidcUser(
        SocialProvider provider,
        String providerUserId,
        @Nullable String nickname,
        @Nullable String email
) {
}
