package com.bibbidi.wedding.auth.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;

class SessionUserIdProviderTest {

    private final SessionUserIdProvider sessionUserIdProvider = new SessionUserIdProvider();

    @Test
    @DisplayName("Session이 없으면 새 Session을 만들지 않고 인증 필요 오류를 반환한다")
    void shouldRejectWithoutCreatingSessionWhenSessionDoesNotExist() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        BusinessException exception = catchThrowableOfType(
                BusinessException.class,
                () -> sessionUserIdProvider.getCurrentUserId(request)
        );

        assertThat(exception.clientError()).isEqualTo(ClientError.AUTHENTICATION_REQUIRED);
        assertThat(request.getSession(false)).isNull();
    }

    @Test
    @DisplayName("Session의 사용자 ID 타입이 올바르지 않으면 인증 필요 오류를 반환한다")
    void shouldRejectWhenSessionUserIdHasInvalidType() {
        MockHttpServletRequest request = requestWithUserId("1");

        BusinessException exception = catchThrowableOfType(
                BusinessException.class,
                () -> sessionUserIdProvider.getCurrentUserId(request)
        );

        assertThat(exception.clientError()).isEqualTo(ClientError.AUTHENTICATION_REQUIRED);
    }

    @Test
    @DisplayName("Session의 사용자 ID가 양수가 아니면 인증 필요 오류를 반환한다")
    void shouldRejectWhenSessionUserIdIsNotPositive() {
        MockHttpServletRequest request = requestWithUserId(0L);

        BusinessException exception = catchThrowableOfType(
                BusinessException.class,
                () -> sessionUserIdProvider.getCurrentUserId(request)
        );

        assertThat(exception.clientError()).isEqualTo(ClientError.AUTHENTICATION_REQUIRED);
    }

    @Test
    @DisplayName("Session에 유효한 사용자 ID가 있으면 현재 사용자 ID를 반환한다")
    void shouldReturnCurrentUserIdFromSession() {
        MockHttpServletRequest request = requestWithUserId(7L);

        Long currentUserId = sessionUserIdProvider.getCurrentUserId(request);

        assertThat(currentUserId).isEqualTo(7L);
    }

    private MockHttpServletRequest requestWithUserId(Object userId) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, userId);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(session);
        return request;
    }
}
