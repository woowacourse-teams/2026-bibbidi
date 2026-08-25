package com.bibbidi.wedding.auth.session;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;

@Component
public class SessionUserIdProvider {

    public Long getCurrentUserId(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            throw authenticationRequired();
        }

        Object userId = session.getAttribute(AuthSession.USER_ID_ATTRIBUTE);
        if (!(userId instanceof Long currentUserId) || currentUserId <= 0) {
            throw authenticationRequired();
        }

        return currentUserId;
    }

    private BusinessException authenticationRequired() {
        return new BusinessException(ClientError.AUTHENTICATION_REQUIRED, "Session에 유효한 사용자 ID가 없습니다.");
    }
}
