package com.bibbidi.wedding.auth.session;

import com.bibbidi.wedding.common.auth.Auth;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

@Component
public class AuthArgumentResolver implements HandlerMethodArgumentResolver {

    private final SessionUserIdProvider sessionUserIdProvider;
    private final AccessTokenUserIdProvider accessTokenUserIdProvider;

    public AuthArgumentResolver(SessionUserIdProvider sessionUserIdProvider, AccessTokenUserIdProvider accessTokenUserIdProvider) {
        this.sessionUserIdProvider = sessionUserIdProvider;
        this.accessTokenUserIdProvider = accessTokenUserIdProvider;
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(Auth.class)
                && parameter.getParameterType().equals(Long.class);
    }

    @Override
    public Object resolveArgument(
            MethodParameter parameter,
            ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest,
            WebDataBinderFactory binderFactory
    ) {
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        if (request == null) {
            throw new IllegalStateException("HttpServletRequest를 확인할 수 없습니다.");
        }

        Optional<String> authorizationHeader = accessTokenUserIdProvider.findAuthorizationHeader(request);
        if (authorizationHeader.isPresent()) {
            return accessTokenUserIdProvider.getCurrentUserId(authorizationHeader.get());
        }

        return sessionUserIdProvider.getCurrentUserId(request);
    }
}
