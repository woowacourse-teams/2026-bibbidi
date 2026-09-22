package com.bibbidi.wedding.auth.security;

import java.util.function.Supplier;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.stereotype.Component;

/**
 * 약관에 동의해 가입을 끝낸 회원만 통과시킨다.
 *
 * <p>가입 상태를 권한 이름으로 바꿔 쓰지 않는다. 권한은 무엇을 할 수 있는지를 가르는 축이고,
 * 가입 상태는 서비스를 쓸 준비가 됐는지를 가르는 다른 축이기 때문이다.
 */
@Component
public class ActiveUserAuthorizationManager
        implements AuthorizationManager<RequestAuthorizationContext> {

    @Override
    public AuthorizationDecision authorize(
            Supplier<? extends Authentication> authentication, RequestAuthorizationContext context) {
        Authentication current = authentication.get();
        if (current == null || !current.isAuthenticated()) {
            return new AuthorizationDecision(false);
        }
        return new AuthorizationDecision(
                current.getPrincipal() instanceof AuthenticatedUser user && user.isActive());
    }
}
