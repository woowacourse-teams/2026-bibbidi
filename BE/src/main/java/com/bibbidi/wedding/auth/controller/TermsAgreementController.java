package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.TermsAgreementRequest;
import com.bibbidi.wedding.auth.controller.dto.TermsAgreementResponse;
import com.bibbidi.wedding.auth.service.terms.TermsAgreementService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** 가입을 끝내는 자리다. 동의하기 전에는 이 API 말고는 부를 수 없다. */
@RestController
public class TermsAgreementController {

    private final TermsAgreementService termsAgreementService;

    public TermsAgreementController(TermsAgreementService termsAgreementService) {
        this.termsAgreementService = termsAgreementService;
    }

    @PostMapping("/api/users/me/terms-agreement")
    public TermsAgreementResponse agree(
            @AuthenticationPrincipal(expression = "userId") Long currentUserId,
            @Valid @RequestBody TermsAgreementRequest request
    ) {
        return new TermsAgreementResponse(
                termsAgreementService.agree(currentUserId, request.agreedTermsIds()));
    }
}
