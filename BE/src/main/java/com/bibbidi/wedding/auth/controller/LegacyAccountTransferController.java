package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.request.LegacyAccountTransferRequest;
import com.bibbidi.wedding.auth.controller.dto.response.BibbidiSessionResponse;
import com.bibbidi.wedding.auth.service.LegacyAccountTransferService;
import com.bibbidi.wedding.auth.service.dto.IssuedSession;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LegacyAccountTransferController {

    private final LegacyAccountTransferService legacyAccountTransferService;
    private final AuthCookieFactory authCookieFactory;

    public LegacyAccountTransferController(
            LegacyAccountTransferService legacyAccountTransferService,
            AuthCookieFactory authCookieFactory
    ) {
        this.legacyAccountTransferService = legacyAccountTransferService;
        this.authCookieFactory = authCookieFactory;
    }

    @PostMapping("/api/users/me/legacy-account-transfer")
    @ResponseStatus(HttpStatus.CREATED)
    public BibbidiSessionResponse transfer(
            @AuthenticationPrincipal(expression = "userId") Long currentUserId,
            @Valid @RequestBody LegacyAccountTransferRequest request,
            HttpServletResponse response
    ) {
        IssuedSession session = legacyAccountTransferService.transfer(
                currentUserId,
                request.nickname(),
                request.password());

        response.addHeader(
                HttpHeaders.SET_COOKIE,
                authCookieFactory.refreshToken(session.refreshToken()).toString());
        return BibbidiSessionResponse.from(session);
    }
}
