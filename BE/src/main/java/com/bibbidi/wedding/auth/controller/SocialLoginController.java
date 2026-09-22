package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.NativeSessionResponse;
import com.bibbidi.wedding.auth.controller.dto.SocialAuthorizationResponse;
import com.bibbidi.wedding.auth.controller.dto.SocialLoginRequest;
import com.bibbidi.wedding.auth.controller.dto.WebSessionResponse;
import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.SocialAuthPurpose;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.service.login.SocialAuthorizationResult;
import com.bibbidi.wedding.auth.service.login.SocialLoginService;
import com.bibbidi.wedding.auth.service.session.IssuedSession;
import jakarta.servlet.http.HttpServletRequest;
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
 *
 * <p>웹은 인가를 시작할 때 브라우저에만 남는 값을 쿠키로 심고 돌아왔을 때 그 쿠키를 확인한다.
 * 그래야 남이 받은 인가 결과를 피해자 브라우저에 제출시켜 남의 계정으로 로그인시키는 일을 막는다.
 */
@RestController
public class SocialLoginController {

    private final SocialLoginService socialLoginService;
    private final RefreshCookieFactory refreshCookieFactory;
    private final OidcBinderCookieFactory binderCookieFactory;

    public SocialLoginController(
            SocialLoginService socialLoginService,
            RefreshCookieFactory refreshCookieFactory,
            OidcBinderCookieFactory binderCookieFactory
    ) {
        this.socialLoginService = socialLoginService;
        this.refreshCookieFactory = refreshCookieFactory;
        this.binderCookieFactory = binderCookieFactory;
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
                    binderCookieFactory.create(result.browserBinder()).toString());
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
                binderCookieFactory.read(servletRequest));

        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.create(session.refreshToken()).toString())
                .header(HttpHeaders.SET_COOKIE, binderCookieFactory.expired().toString())
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
}
