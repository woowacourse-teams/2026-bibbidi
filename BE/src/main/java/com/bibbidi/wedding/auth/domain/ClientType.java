package com.bibbidi.wedding.auth.domain;

/** refresh token을 어떤 형태로 주고받는지 가른다. 웹은 쿠키, 네이티브는 응답 본문이다. */
public enum ClientType {
    WEB,
    NATIVE,
}
