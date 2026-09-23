package com.bibbidi.wedding.auth.controller.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;

public record TermsAgreementRequest(
        @NotBlank String termsVersion,
        boolean agreed
) {

    @AssertTrue(message = "약관 동의 값은 true여야 합니다.")
    public boolean isAgreed() {
        return agreed;
    }
}
