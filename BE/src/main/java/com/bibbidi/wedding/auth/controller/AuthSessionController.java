package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.request.NativeSessionRefreshRequest;
import com.bibbidi.wedding.auth.controller.dto.request.SocialLoginRequest;
import com.bibbidi.wedding.auth.controller.dto.response.BibbidiTokenResponse;
import com.bibbidi.wedding.auth.controller.dto.response.SocialAuthorizationResponse;
import com.bibbidi.wedding.auth.controller.dto.response.BibbidiSessionResponse;
import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.SocialAuthPurpose;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.service.SessionRefreshService;
import com.bibbidi.wedding.auth.service.SocialLoginService;
import com.bibbidi.wedding.auth.service.dto.IssuedSession;
import com.bibbidi.wedding.auth.service.dto.SocialAuthorizationResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

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
    public SocialAuthorizationResponse startAuthorization(
            @PathVariable String provider,
            @RequestParam ClientType clientType,
            @RequestParam(defaultValue = "LOGIN") SocialAuthPurpose purpose,
            HttpServletResponse response
    ) {
        SocialAuthorizationResult result = socialLoginService.startAuthorization(
                SocialProvider.from(provider), clientType, purpose);

        if (result.browserBinder() != null) {
            response.addHeader(HttpHeaders.SET_COOKIE,
                    authCookieFactory.oidcBinder(result.browserBinder()).toString());
        }
        return SocialAuthorizationResponse.from(result);
    }

    @PostMapping("/api/auth/web/oidc/{provider}/callback")
    @ResponseStatus(HttpStatus.CREATED)
    public BibbidiSessionResponse loginOnWeb(
            @PathVariable String provider,
            @Valid @RequestBody SocialLoginRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse response
    ) {
        IssuedSession session = socialLoginService.login(
                SocialProvider.from(provider),
                ClientType.WEB,
                request.code(),
                request.state(),
                authCookieFactory.readOidcBinder(servletRequest));

        response.addHeader(
                HttpHeaders.SET_COOKIE,
                authCookieFactory.refreshToken(session.refreshToken()).toString());
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                authCookieFactory.expiredOidcBinder().toString());
        return BibbidiSessionResponse.from(session);
    }

    @PostMapping("/api/auth/native/oidc/{provider}/callback")
    @ResponseStatus(HttpStatus.CREATED)
    public BibbidiTokenResponse loginOnNative(
            @PathVariable String provider,
            @Valid @RequestBody SocialLoginRequest request
    ) {
        return BibbidiTokenResponse.from(socialLoginService.login(
                SocialProvider.from(provider),
                ClientType.NATIVE,
                request.code(),
                request.state(),
                null));
    }

    @PostMapping("/api/auth/web/sessions/refresh")
    public BibbidiSessionResponse refreshOnWeb(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        IssuedSession session = sessionRefreshService.refresh(
                authCookieFactory.readRefreshToken(request), ClientType.WEB);
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                authCookieFactory.refreshToken(session.refreshToken()).toString());
        return BibbidiSessionResponse.from(session);
    }

    @PostMapping("/api/auth/native/sessions/refresh")
    public BibbidiTokenResponse refreshOnNative(
            @Valid @RequestBody NativeSessionRefreshRequest request) {
        return BibbidiTokenResponse.from(
                sessionRefreshService.refresh(request.refreshToken(), ClientType.NATIVE));
    }

    @DeleteMapping("/api/auth/web/sessions/current")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logOutOnWeb(HttpServletRequest request, HttpServletResponse response) {
        sessionRefreshService.revokeSession(authCookieFactory.readRefreshToken(request));
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                authCookieFactory.expiredRefreshToken().toString());
    }

    @DeleteMapping("/api/auth/native/sessions/current")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logOutOnNative(@Valid @RequestBody NativeSessionRefreshRequest request) {
        sessionRefreshService.revokeSession(request.refreshToken());
    }
}
