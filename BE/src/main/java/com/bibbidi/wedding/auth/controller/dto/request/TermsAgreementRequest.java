package com.bibbidi.wedding.auth.controller.dto.request;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/** @param agreedTermsIds 동의한 약관들의 식별자. 필수 약관이 하나라도 빠지면 가입이 끝나지 않는다 */
public record TermsAgreementRequest(@NotEmpty List<Long> agreedTermsIds) {
}
