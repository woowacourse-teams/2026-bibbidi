package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.service.dto.IssuedSession;
import com.bibbidi.wedding.auth.service.dto.UserAuthInfo;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class HandoffServiceIntegrationTest {

    @Autowired
    private HandoffService handoffService;

    @Autowired
    private SessionIssueService sessionIssueService;

    @Autowired
    private SessionRefreshService sessionRefreshService;

    @Autowired
    private UserService userService;

    private UserAuthInfo owner;
    private IssuedSession nativeSession;

    @BeforeEach
    void setUp() {
        UserResult created = userService.createPendingUser("current", "current@bibbidi.kr");
        UserResult active = userService.activate(created.id());
        owner = new UserAuthInfo(
                active.id(), active.status(), active.role(), active.nickname(), active.email());
        nativeSession = sessionIssueService.issueForNewFamily(owner, ClientType.NATIVE);
    }

    @Test
    @DisplayName("넘겨받은 웹 세션은 앱 세션과 같은 기기 계열에 들어간다")
    void shouldPutHandedOffWebSessionInSameFamily() {
        String code = handoffService.issueCode(owner.userId());

        IssuedSession webSession = handoffService.exchange(code);

        assertThat(webSession.familyId()).isEqualTo(nativeSession.familyId());
        assertThat(webSession.clientType()).isEqualTo(ClientType.WEB);
    }

    @Test
    @DisplayName("handoff code는 한 번만 통한다")
    void shouldAllowHandoffCodeOnlyOnce() {
        String code = handoffService.issueCode(owner.userId());
        handoffService.exchange(code);

        assertThatThrownBy(() -> handoffService.exchange(code))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.HANDOFF_CODE_INVALID);
    }

    @Test
    @DisplayName("서버가 만든 적 없는 code는 거절한다")
    void shouldRejectUnknownHandoffCode() {
        assertThatThrownBy(() -> handoffService.exchange("code-we-never-made"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.HANDOFF_CODE_INVALID);
    }

    @Test
    @DisplayName("native 세션이 없는 회원은 code를 받을 수 없다")
    void shouldRejectIssuingCodeForOtherUsersSession() {
        UserResult other = userService.createPendingUser("other", null);

        assertThatThrownBy(() -> handoffService.issueCode(other.id()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.REFRESH_SESSION_INVALID);
    }

    @Test
    @DisplayName("native 세션이 폐기되면 code를 받을 수 없다")
    void shouldRejectIssuingCodeWithoutUsableSession() {
        sessionRefreshService.revokeSession(nativeSession.refreshToken());

        assertThatThrownBy(() -> handoffService.issueCode(owner.userId()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.REFRESH_SESSION_INVALID);
    }

    @Test
    @DisplayName("앱 쪽에서 토큰 재사용이 감지되면 넘겨준 웹 세션도 함께 끊긴다")
    void shouldRevokeHandedOffWebSessionWhenNativeTokenIsReused() {
        String code = handoffService.issueCode(owner.userId());
        IssuedSession webSession = handoffService.exchange(code);
        sessionRefreshService.refresh(nativeSession.refreshToken(), ClientType.NATIVE);

        assertThatThrownBy(
                () -> sessionRefreshService.refresh(nativeSession.refreshToken(), ClientType.NATIVE))
                .isInstanceOf(BusinessException.class);

        assertThatThrownBy(
                () -> sessionRefreshService.refresh(webSession.refreshToken(), ClientType.WEB))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.REFRESH_SESSION_INVALID);
    }

    @Test
    @DisplayName("native 세션 계열이 폐기되면 handoff code를 교환할 수 없다")
    void shouldRejectHandoffCodeFromRevokedFamily() {
        String code = handoffService.issueCode(owner.userId());
        sessionRefreshService.revokeSession(nativeSession.refreshToken());

        assertThatThrownBy(() -> handoffService.exchange(code))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.HANDOFF_CODE_INVALID);
    }
}
