package com.bibbidi.wedding.auth.session;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod) || !requiresAuthentication(handlerMethod)) {
            return true;
        }

        HttpSession session = request.getSession(false);
        if (session == null || !(session.getAttribute(AuthSession.USER_ID_ATTRIBUTE) instanceof Long)) {
            throw new BusinessException(ClientError.AUTHENTICATION_REQUIRED, "인증되지 않은 요청입니다.");
        }

        return true;
    }

    private boolean requiresAuthentication(HandlerMethod handlerMethod) {
        return handlerMethod.hasMethodAnnotation(Auth.class)
                || handlerMethod.getBeanType().isAnnotationPresent(Auth.class);
    }
}
