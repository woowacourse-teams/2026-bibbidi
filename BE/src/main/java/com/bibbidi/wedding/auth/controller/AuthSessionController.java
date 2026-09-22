package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.request.NativeSessionRefreshRequest;
import com.bibbidi.wedding.auth.controller.dto.request.SocialLoginRequest;
import com.bibbidi.wedding.auth.controller.dto.response.NativeSessionResponse;
import com.bibbidi.wedding.auth.controller.dto.response.SocialAuthorizationResponse;
import com.bibbidi.wedding.auth.controller.dto.response.WebSessionResponse;
import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.SocialAuthPurpose;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.service.dto.IssuedSession;
import com.bibbidi.wedding.auth.service.dto.SocialAuthorizationResult;
import com.bibbidi.wedding.auth.service.SocialLoginService;
import com.bibbidi.wedding.auth.service.SessionRefreshService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 로그인 세션을 얻고, 잇고, 끊는다.
 *
 * <p>웹과 네이티브는 같은 검증을 거치지만 refresh token을 받는 방식이 달라 경로를 나눈다.
 * 웹은 자바스크립트가 읽을 수 없는 쿠키로, 네이티브는 쿠키를 쓰지 않으므로 응답 본문으로 주고받는다.
 *
 * <p>인가를 시작할 때 웹 브라우저에만 남는 값을 쿠키로 심고 돌아왔을 때 확인한다.
 * 그래야 남이 받은 인가 결과를 피해자 브라우저에 제출시켜 남의 계정으로 로그인시키는 일을 막는다.
 */
@RestController
public class AuthSessionController {

    private final SocialLoginService socialLoginService;
    private final SessionRefreshService sessionRefreshService;
    private final AuthCookieFactory authCookieFactory;

    public AuthSessionController(
            SocialLoginService socialLoginService,
            SessionRefreshService sessionRefreshService,
            AuthCookieFactory authCookieFactory
    ) {
        this.socialLoginService = socialLoginService;
        this.sessionRefreshService = sessionRefreshService;
        this.authCookieFactory = authCookieFactory;
    }

    @GetMapping("/api/auth/oidc/{provider}/authorization")
    public ResponseEntity<SocialAuthorizationResponse> startAuthorization(
            @PathVariable String provider,
            @RequestParam ClientType clientType,
            @RequestParam(defaultValue = "LOGIN") SocialAuthPurpose purpose
    ) {
        SocialAuthorizationResult result = socialLoginService.startAuthorization(
                SocialProvider.from(provider), clientType, purpose);

        ResponseEntity.BodyBuilder response = ResponseEntity.ok();
        if (result.browserBinder() != null) {
            response.header(HttpHeaders.SET_COOKIE,
                    authCookieFactory.oidcBinder(result.browserBinder()).toString());
        }
        return response.body(SocialAuthorizationResponse.from(result));
    }

    @PostMapping("/api/auth/web/oidc/{provider}/callback")
    public ResponseEntity<WebSessionResponse> loginOnWeb(
            @PathVariable String provider,
            @Valid @RequestBody SocialLoginRequest request,
            HttpServletRequest servletRequest
    ) {
        IssuedSession session = socialLoginService.login(
                SocialProvider.from(provider),
                ClientType.WEB,
                request.code(),
                request.state(),
                authCookieFactory.readOidcBinder(servletRequest));

        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, authCookieFactory.refreshToken(session.refreshToken()).toString())
                .header(HttpHeaders.SET_COOKIE, authCookieFactory.expiredOidcBinder().toString())
                .body(WebSessionResponse.from(session));
    }

    @PostMapping("/api/auth/native/oidc/{provider}/callback")
    @ResponseStatus(HttpStatus.CREATED)
    public NativeSessionResponse loginOnNative(
            @PathVariable String provider,
            @Valid @RequestBody SocialLoginRequest request
    ) {
        return NativeSessionResponse.from(socialLoginService.login(
                SocialProvider.from(provider),
                ClientType.NATIVE,
                request.code(),
                request.state(),
                null));
    }

    @PostMapping("/api/auth/web/sessions/refresh")
    public ResponseEntity<WebSessionResponse> refreshOnWeb(HttpServletRequest request) {
        IssuedSession session = sessionRefreshService.refresh(
                authCookieFactory.readRefreshToken(request), ClientType.WEB);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, authCookieFactory.refreshToken(session.refreshToken()).toString())
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
        sessionRefreshService.revokeSession(authCookieFactory.readRefreshToken(request));
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, authCookieFactory.expiredRefreshToken().toString())
                .build();
    }

    @DeleteMapping("/api/auth/native/sessions/current")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logOutOnNative(@Valid @RequestBody NativeSessionRefreshRequest request) {
        sessionRefreshService.revokeSession(request.refreshToken());
    }
}
