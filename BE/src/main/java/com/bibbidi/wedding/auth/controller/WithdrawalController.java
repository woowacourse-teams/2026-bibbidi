package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.response.DeleteGrantResponse;
import com.bibbidi.wedding.auth.controller.dto.request.SocialLoginRequest;
import com.bibbidi.wedding.auth.controller.dto.request.WithdrawalRequest;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.service.WithdrawalService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 탈퇴를 맡는다. 토큰만으로는 지우지 않는다. 소셜로 한 번 더 인증해 받은 표를 함께 내야 한다.
 */
@RestController
public class WithdrawalController {

    private final WithdrawalService withdrawalService;
    private final AuthCookieFactory authCookieFactory;

    public WithdrawalController(
            WithdrawalService withdrawalService,
            AuthCookieFactory authCookieFactory
    ) {
        this.withdrawalService = withdrawalService;
        this.authCookieFactory = authCookieFactory;
    }

    @PostMapping("/api/auth/delete-grants/{provider}/callback")
    @ResponseStatus(HttpStatus.CREATED)
    public DeleteGrantResponse issueDeleteGrantToken(
            @AuthenticationPrincipal(expression = "userId") Long currentUserId,
            @PathVariable String provider,
            @Valid @RequestBody SocialLoginRequest request,
            HttpServletRequest servletRequest
    ) {
        SocialProvider socialProvider = SocialProvider.from(provider);
        String browserBinder = authCookieFactory.readOidcBinder(servletRequest);
        String deleteGrantToken = withdrawalService.issueDeleteGrantToken(
                socialProvider,
                request.code(),
                request.state(),
                browserBinder,
                currentUserId);
        return new DeleteGrantResponse(deleteGrantToken);
    }

    @DeleteMapping("/api/users/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdraw(
            @AuthenticationPrincipal(expression = "userId") Long currentUserId,
            @Valid @RequestBody WithdrawalRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        withdrawalService.withdraw(currentUserId, request.deleteGrant());
        if (authCookieFactory.hasRefreshToken(servletRequest)) {
            servletResponse.addHeader(
                    HttpHeaders.SET_COOKIE,
                    authCookieFactory.expiredRefreshToken().toString());
        }
    }
}
