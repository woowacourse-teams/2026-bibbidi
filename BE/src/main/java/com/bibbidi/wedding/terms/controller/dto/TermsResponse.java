package com.bibbidi.wedding.terms.controller.dto;

import com.bibbidi.wedding.terms.service.TermsResult;

/**
 * @param id 동의할 때 돌려보내는 값
 * @param required 동의해야만 가입이 끝나는지
 */
public record TermsResponse(
        Long id,
        String code,
        String version,
        String title,
        String content,
        boolean required
) {

    public static TermsResponse from(TermsResult result) {
        return new TermsResponse(
                result.id(),
                result.code(),
                result.version(),
                result.title(),
                result.content(),
                result.required());
    }
}
