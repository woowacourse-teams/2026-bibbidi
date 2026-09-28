package com.bibbidi.wedding.terms.domain;

import org.jspecify.annotations.Nullable;

/**
 * 사용자에게 보여 주고 동의를 받는 약관 한 건이다.
 *
 * @param code 약관 종류를 가리키는 값. 문구가 바뀌어도 종류는 그대로다
 * @param version 문구의 판. 같은 종류라도 판이 다르면 다른 약관으로 본다
 * @param required 동의해야만 가입이 끝나는지
 */
public record Terms(
        @Nullable Long id,
        String code,
        String version,
        String title,
        String content,
        boolean required
) {
}
