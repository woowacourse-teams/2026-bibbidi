package com.bibbidi.wedding.terms.domain;

import java.time.LocalDateTime;
import org.jspecify.annotations.Nullable;

/** 누가 어떤 약관에 언제 동의했는지다. 문구가 바뀌어도 이 기록은 남는다. */
public record TermsAgreement(
        @Nullable Long id,
        Long userId,
        Long termsId,
        LocalDateTime agreedAt
) {

    public static TermsAgreement of(Long userId, Long termsId, LocalDateTime agreedAt) {
        return new TermsAgreement(null, userId, termsId, agreedAt);
    }
}
