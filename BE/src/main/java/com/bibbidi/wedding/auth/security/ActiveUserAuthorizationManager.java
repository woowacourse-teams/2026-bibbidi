package com.bibbidi.wedding.auth.security;

import java.util.function.Supplier;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;

public class ActiveUserAuthorizationManager implements AuthorizationManager<RequestAuthorizationContext> {

    @Override
    public AuthorizationDecision authorize(
            Supplier<? extends Authentication> authentication,
            RequestAuthorizationContext context
    ) {
        Authentication current = authentication.get();
        if (current == null) {
            return new AuthorizationDecision(false);
        }
        if (!current.isAuthenticated()) {
            return new AuthorizationDecision(false);
        }
        return new AuthorizationDecision(
                current.getPrincipal() instanceof AuthenticatedUser user && user.isActive());
    }
}
