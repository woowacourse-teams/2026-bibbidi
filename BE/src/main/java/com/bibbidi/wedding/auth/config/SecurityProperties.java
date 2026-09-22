package com.bibbidi.wedding.auth.config;

import com.bibbidi.wedding.common.domain.UserRole;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 어떤 요청을 누가 부를 수 있는지에 관한 값이다.
 *
 * <p>수집 도구가 컨테이너 망에서 직접 긁는 경로는 열어 두고, 외부 차단은 앞단 nginx가 한다.
 *
 * @param permitPendingUser 로그인은 필요하지만 가입을 끝내지 않은 회원도 부를 수 있는 경로.
 *                          permitAll보다 먼저 판단한다
 * @param permitAll 인증 없이 허용할 경로
 */
@ConfigurationProperties(prefix = "auth.security")
public record SecurityProperties(
        List<String> permitPendingUser,
        List<String> permitAll
) {

    /** Spring Security가 역할을 나타낼 때 쓰는 접두어다. */
    private static final String ROLE_AUTHORITY_PREFIX = "ROLE_";

    public static String authorityOf(UserRole role) {
        return ROLE_AUTHORITY_PREFIX + role.name();
    }

    public String[] permitPendingUserPatterns() {
        return permitPendingUser.toArray(String[]::new);
    }

    public String[] permitAllPatterns() {
        return permitAll.toArray(String[]::new);
    }
}
