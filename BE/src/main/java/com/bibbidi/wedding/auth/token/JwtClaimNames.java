package com.bibbidi.wedding.auth.token;

/** 직접 정한 claim 이름을 한곳에 모은다. 표준 claim은 jjwt가 제공하는 이름을 그대로 쓴다. */
final class JwtClaimNames {

    static final String CATEGORY = "category";
    static final String STATUS = "status";
    static final String ROLE = "role";
    static final String NICKNAME = "nickname";
    static final String EMAIL = "email";

    private JwtClaimNames() {
    }
}
