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
            throw new BusinessException(ClientError.AUTHENTICATION_REQUIRED, "현재 사용자 ID 조회 실패: 요청에 세션이 없습니다.");
        }

        Object userId = session.getAttribute(AuthSession.USER_ID_ATTRIBUTE);
        if (!(userId instanceof Long currentUserId) || currentUserId <= 0) {
            throw new BusinessException(ClientError.AUTHENTICATION_REQUIRED,
                    "현재 사용자 ID 조회 실패: 세션의 사용자 ID가 없거나 양수인 Long 타입이 아닙니다.");
        }

        return currentUserId;
    }
}
