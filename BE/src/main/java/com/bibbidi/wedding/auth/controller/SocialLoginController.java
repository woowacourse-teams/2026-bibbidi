package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.NativeSessionResponse;
import com.bibbidi.wedding.auth.controller.dto.SocialAuthorizationResponse;
import com.bibbidi.wedding.auth.controller.dto.SocialLoginRequest;
import com.bibbidi.wedding.auth.controller.dto.WebSessionResponse;
import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.SocialAuthPurpose;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.service.login.SocialLoginService;
import com.bibbidi.wedding.auth.service.session.IssuedSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 소셜 로그인 입구다. 웹과 네이티브는 같은 검증을 거치지만 refresh token을 받는 방식이 달라 경로를 나눈다.
 */
@RestController
public class SocialLoginController {

    private final SocialLoginService socialLoginService;
    private final RefreshCookieFactory refreshCookieFactory;

    public SocialLoginController(
            SocialLoginService socialLoginService,
            RefreshCookieFactory refreshCookieFactory
    ) {
        this.socialLoginService = socialLoginService;
        this.refreshCookieFactory = refreshCookieFactory;
    }

    @GetMapping("/api/auth/oidc/{provider}/authorization")
    public SocialAuthorizationResponse startAuthorization(
            @PathVariable String provider,
            @RequestParam ClientType clientType,
            @RequestParam(defaultValue = "LOGIN") SocialAuthPurpose purpose
    ) {
        return SocialAuthorizationResponse.from(
                socialLoginService.startAuthorization(
                        SocialProvider.from(provider),
                        clientType,
                        purpose
                )
        );
    }

    @PostMapping("/api/auth/web/oidc/{provider}/callback")
    public ResponseEntity<WebSessionResponse> loginOnWeb(
            @PathVariable String provider,
            @Valid @RequestBody SocialLoginRequest request
    ) {
        IssuedSession session = socialLoginService.login(
                SocialProvider.from(provider), ClientType.WEB, request.code(), request.state());
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.create(session.refreshToken()).toString())
                .body(WebSessionResponse.from(session));
    }

    @PostMapping("/api/auth/native/oidc/{provider}/callback")
    @ResponseStatus(HttpStatus.CREATED)
    public NativeSessionResponse loginOnNative(
            @PathVariable String provider,
            @Valid @RequestBody SocialLoginRequest request
    ) {
        return NativeSessionResponse.from(socialLoginService.login(
                SocialProvider.from(provider), ClientType.NATIVE, request.code(), request.state()));
    }
}
