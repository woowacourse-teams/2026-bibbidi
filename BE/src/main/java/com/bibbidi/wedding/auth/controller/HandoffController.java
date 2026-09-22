package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.HandoffCodeExchangeRequest;
import com.bibbidi.wedding.auth.controller.dto.HandoffCodeResponse;
import com.bibbidi.wedding.auth.controller.dto.NativeSessionRefreshRequest;
import com.bibbidi.wedding.auth.controller.dto.WebSessionResponse;
import com.bibbidi.wedding.auth.service.handoff.HandoffService;
import com.bibbidi.wedding.auth.service.session.IssuedSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 네이티브에서 한 로그인을 앱 안 WebView로 넘긴다.
 * 앱이 코드를 받아 WebView 주소에 실어 열면, WebView가 그 코드를 내고 웹 세션 쿠키를 받는다.
 */
@RestController
public class HandoffController {

    private final HandoffService handoffService;
    private final RefreshCookieFactory refreshCookieFactory;

    public HandoffController(HandoffService handoffService, RefreshCookieFactory refreshCookieFactory) {
        this.handoffService = handoffService;
        this.refreshCookieFactory = refreshCookieFactory;
    }

    @PostMapping("/api/auth/native/handoff-codes")
    @ResponseStatus(HttpStatus.CREATED)
    public HandoffCodeResponse issueCode(
            @AuthenticationPrincipal(expression = "userId") Long currentUserId,
            @Valid @RequestBody NativeSessionRefreshRequest request
    ) {
        return new HandoffCodeResponse(handoffService.issueCode(currentUserId, request.refreshToken()));
    }

    @PostMapping("/api/auth/web/handoff-codes/exchange")
    public ResponseEntity<WebSessionResponse> exchange(
            @Valid @RequestBody HandoffCodeExchangeRequest request) {
        IssuedSession session = handoffService.exchange(request.code());
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.create(session.refreshToken()).toString())
                .body(WebSessionResponse.from(session));
    }
}
