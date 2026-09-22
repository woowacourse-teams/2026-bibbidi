package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.DeleteGrantResponse;
import com.bibbidi.wedding.auth.controller.dto.SocialLoginRequest;
import com.bibbidi.wedding.auth.controller.dto.WithdrawalRequest;
import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.service.withdrawal.WithdrawalService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 탈퇴를 맡는다.
 * 토큰만으로는 지우지 않는다. 소셜로 한 번 더 인증해 받은 표를 함께 내야 한다.
 */
@RestController
public class WithdrawalController {

    private final WithdrawalService withdrawalService;
    private final RefreshCookieFactory refreshCookieFactory;

    public WithdrawalController(
            WithdrawalService withdrawalService,
            RefreshCookieFactory refreshCookieFactory
    ) {
        this.withdrawalService = withdrawalService;
        this.refreshCookieFactory = refreshCookieFactory;
    }

    @PostMapping("/api/auth/delete-grants/{provider}/callback")
    @ResponseStatus(HttpStatus.CREATED)
    public DeleteGrantResponse issueDeleteGrant(
            @AuthenticationPrincipal(expression = "userId") Long currentUserId,
            @PathVariable String provider,
            @RequestParam ClientType clientType,
            @Valid @RequestBody SocialLoginRequest request
    ) {
        return new DeleteGrantResponse(withdrawalService.issueDeleteGrant(
                SocialProvider.from(provider), clientType, request.code(), request.state(), currentUserId));
    }

    @DeleteMapping("/api/users/me")
    public ResponseEntity<Void> withdraw(
            @AuthenticationPrincipal(expression = "userId") Long currentUserId,
            @Valid @RequestBody WithdrawalRequest request
    ) {
        withdrawalService.withdraw(currentUserId, request.deleteGrant());
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.expired().toString())
                .build();
    }
}
