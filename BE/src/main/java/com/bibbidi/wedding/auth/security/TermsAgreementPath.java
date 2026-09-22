package com.bibbidi.wedding.auth.security;

/**
 * 약관에 동의하기 전 사용자가 유일하게 부를 수 있는 경로다.
 * 인가 규칙과 컨트롤러가 같은 값을 보도록 한곳에 둔다.
 */
public final class TermsAgreementPath {

    public static final String PATH = "/api/users/me/terms-agreement";

    private TermsAgreementPath() {
    }
}
