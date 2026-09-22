package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.NativeSessionRefreshRequest;
import com.bibbidi.wedding.auth.controller.dto.NativeSessionResponse;
import com.bibbidi.wedding.auth.controller.dto.WebSessionResponse;
import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.service.session.IssuedSession;
import com.bibbidi.wedding.auth.service.session.SessionRefreshService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 로그인 상태를 이어 가거나 끊는다.
 * 웹은 쿠키로, 네이티브는 응답 본문으로 refresh token을 주고받는다.
 */
@RestController
public class SessionController {

    private final SessionRefreshService sessionRefreshService;
    private final RefreshCookieFactory refreshCookieFactory;

    public SessionController(
            SessionRefreshService sessionRefreshService,
            RefreshCookieFactory refreshCookieFactory
    ) {
        this.sessionRefreshService = sessionRefreshService;
        this.refreshCookieFactory = refreshCookieFactory;
    }

    @PostMapping("/api/auth/web/sessions/refresh")
    public ResponseEntity<WebSessionResponse> refreshOnWeb(HttpServletRequest request) {
        IssuedSession session = sessionRefreshService.refresh(
                refreshCookieFactory.read(request), ClientType.WEB);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.create(session.refreshToken()).toString())
                .body(WebSessionResponse.from(session));
    }

    @PostMapping("/api/auth/native/sessions/refresh")
    public NativeSessionResponse refreshOnNative(
            @Valid @RequestBody NativeSessionRefreshRequest request) {
        return NativeSessionResponse.from(
                sessionRefreshService.refresh(request.refreshToken(), ClientType.NATIVE));
    }

    @DeleteMapping("/api/auth/web/sessions/current")
    public ResponseEntity<Void> logOutOnWeb(HttpServletRequest request) {
        sessionRefreshService.revokeSession(refreshCookieFactory.read(request));
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.expired().toString())
                .build();
    }

    @DeleteMapping("/api/auth/native/sessions/current")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logOutOnNative(@Valid @RequestBody NativeSessionRefreshRequest request) {
        sessionRefreshService.revokeSession(request.refreshToken());
    }
}
