package com.bibbidi.wedding.auth.controller;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 웹에 내려 주는 refresh 쿠키의 모양이다.
 *
 * @param name 쿠키 이름
 * @param path 쿠키를 보낼 경로. 인증 API에만 실려 가도록 좁힌다
 * @param sameSite 다른 사이트에서 왔을 때 쿠키를 보낼지
 * @param secure HTTPS에서만 보낼지
 */
@ConfigurationProperties(prefix = "auth.refresh-cookie")
public record RefreshCookieProperties(String name, String path, String sameSite, boolean secure) {
}
