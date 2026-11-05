package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.auth.controller.dto.request.TermsAgreementRequest;
import com.bibbidi.wedding.auth.controller.dto.response.TermsAgreementResponse;
import com.bibbidi.wedding.auth.service.TermsAgreementService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

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
                termsAgreementService.agree(currentUserId, request.termsVersion(), request.agreed()));
    }
}
