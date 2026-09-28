package com.bibbidi.wedding.auth.domain;

/** 소셜 인증을 무엇 때문에 시작했는지다. 로그인과 탈퇴 재인증이 같은 흐름을 쓰되 결과가 다르다. */
public enum SocialAuthPurpose {
    LOGIN,
    WITHDRAWAL,
}
