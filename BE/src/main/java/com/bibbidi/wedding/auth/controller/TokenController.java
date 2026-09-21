package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.AccessTokenResponse;
import com.bibbidi.wedding.auth.controller.dto.IssueTokenRequest;
import com.bibbidi.wedding.auth.service.IssuedTokens;
import com.bibbidi.wedding.auth.service.JwtService;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/tokens")
public class TokenController {

    private final JwtService jwtService;
    private final RefreshTokenCookieManager refreshTokenCookieManager;
    private final RequestOriginValidator requestOriginValidator;

    public TokenController(JwtService jwtService, RefreshTokenCookieManager refreshTokenCookieManager, RequestOriginValidator requestOriginValidator) {
        this.jwtService = jwtService;
        this.refreshTokenCookieManager = refreshTokenCookieManager;
        this.requestOriginValidator = requestOriginValidator;
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public AccessTokenResponse issueTokens(@Valid @RequestBody IssueTokenRequest request, HttpServletResponse servletResponse) {
        IssuedTokens issuedTokens = jwtService.issueTokens(request.nickname(), request.password());
        refreshTokenCookieManager.attach(
                servletResponse, issuedTokens.refreshToken(), issuedTokens.refreshTokenTtl());
        return AccessTokenResponse.from(issuedTokens);
    }

    @PostMapping("/reissue")
    public AccessTokenResponse reissueTokens(HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        requestOriginValidator.validate(servletRequest);

        String refreshToken = refreshTokenCookieManager.findRefreshToken(servletRequest)
                .orElseThrow(() -> new BusinessException(
                        ClientError.AUTHENTICATION_REQUIRED, "토큰 재발급 실패: 요청에 Refresh 쿠키가 없습니다."));

        IssuedTokens issuedTokens = jwtService.reissueTokens(refreshToken);
        refreshTokenCookieManager.attach(
                servletResponse, issuedTokens.refreshToken(), issuedTokens.refreshTokenTtl());
        return AccessTokenResponse.from(issuedTokens);
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/current")
    public void discardCurrentSession(HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        requestOriginValidator.validate(servletRequest);

        Optional<String> refreshToken = refreshTokenCookieManager.findRefreshToken(servletRequest);
        refreshToken.ifPresent(jwtService::discardSession);
        refreshTokenCookieManager.expire(servletResponse);
    }
}
