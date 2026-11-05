package com.bibbidi.wedding.terms.service;

import com.bibbidi.wedding.terms.domain.Terms;

/** 화면에 보여 줄 약관 한 건이다. */
public record TermsResult(
        Long id,
        String code,
        String version,
        String title,
        String content,
        boolean required
) {

    public static TermsResult from(Terms terms) {
        return new TermsResult(
                terms.id(),
                terms.code(),
                terms.version(),
                terms.title(),
                terms.content(),
                terms.required());
    }
}
