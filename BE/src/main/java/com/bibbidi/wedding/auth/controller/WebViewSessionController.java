package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.request.HandoffCodeExchangeRequest;
import com.bibbidi.wedding.auth.controller.dto.response.HandoffCodeResponse;
import com.bibbidi.wedding.auth.controller.dto.response.BibbidiSessionResponse;
import com.bibbidi.wedding.auth.service.HandoffService;
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
public class WebViewSessionController {

    private final HandoffService handoffService;
    private final AuthCookieFactory authCookieFactory;

    public WebViewSessionController(HandoffService handoffService, AuthCookieFactory authCookieFactory) {
        this.handoffService = handoffService;
        this.authCookieFactory = authCookieFactory;
    }

    @PostMapping("/api/auth/native/handoff-codes")
    @ResponseStatus(HttpStatus.CREATED)
    public HandoffCodeResponse issueCode(
            @AuthenticationPrincipal(expression = "userId") Long currentUserId
    ) {
        return new HandoffCodeResponse(handoffService.issueCode(currentUserId));
    }

    @PostMapping("/api/auth/web/handoff-codes/exchange")
    @ResponseStatus(HttpStatus.CREATED)
    public BibbidiSessionResponse exchange(
            @Valid @RequestBody HandoffCodeExchangeRequest request,
            HttpServletResponse response
    ) {
        IssuedSession session = handoffService.exchange(request.code());
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                authCookieFactory.refreshToken(session.refreshToken()).toString());
        return BibbidiSessionResponse.from(session);
    }
}
