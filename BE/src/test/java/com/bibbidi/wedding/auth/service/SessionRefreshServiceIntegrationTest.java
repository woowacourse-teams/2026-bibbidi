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
class SessionRefreshServiceIntegrationTest {

    @Autowired
    private SessionIssueService sessionIssueService;

    @Autowired
    private SessionRefreshService sessionRefreshService;

    @Autowired
    private UserService userService;

    private UserAuthInfo owner;

    @BeforeEach
    void setUp() {
        UserResult created = userService.createPendingUser("current", "current@bibbidi.kr");
        UserResult active = userService.activate(created.id());
        owner = new UserAuthInfo(active.id(), active.status(), active.role(), active.nickname(), active.email());
    }

    @Test
    @DisplayName("갱신하면 새 refresh token을 주고 기기 계열은 그대로 물려받는다")
    void shouldRotateRefreshTokenKeepingFamily() {
        IssuedSession issued = sessionIssueService.issueForNewFamily(owner, ClientType.WEB);

        IssuedSession refreshed = sessionRefreshService.refresh(issued.refreshToken(), ClientType.WEB);

        assertThat(refreshed.refreshToken()).isNotEqualTo(issued.refreshToken());
        assertThat(refreshed.familyId()).isEqualTo(issued.familyId());
    }

    @Test
    @DisplayName("이미 쓴 refresh token을 다시 내면 그 기기 계열의 세션을 모두 폐기한다")
    void shouldRevokeWholeFamilyWhenRefreshTokenIsReused() {
        IssuedSession issued = sessionIssueService.issueForNewFamily(owner, ClientType.WEB);
        IssuedSession refreshed = sessionRefreshService.refresh(issued.refreshToken(), ClientType.WEB);

        assertThatThrownBy(() -> sessionRefreshService.refresh(issued.refreshToken(), ClientType.WEB))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.REFRESH_SESSION_INVALID);

        assertThatThrownBy(() -> sessionRefreshService.refresh(refreshed.refreshToken(), ClientType.WEB))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("한 기기의 세션이 폐기돼도 같은 회원의 다른 기기는 살아 있다")
    void shouldKeepOtherFamilyWhenOneFamilyIsRevoked() {
        IssuedSession web = sessionIssueService.issueForNewFamily(owner, ClientType.WEB);
        IssuedSession mobile = sessionIssueService.issueForNewFamily(owner, ClientType.NATIVE);
        sessionRefreshService.refresh(web.refreshToken(), ClientType.WEB);

        assertThatThrownBy(() -> sessionRefreshService.refresh(web.refreshToken(), ClientType.WEB))
                .isInstanceOf(BusinessException.class);

        IssuedSession refreshedMobile =
                sessionRefreshService.refresh(mobile.refreshToken(), ClientType.NATIVE);
        assertThat(refreshedMobile.familyId()).isEqualTo(mobile.familyId());
    }

    @Test
    @DisplayName("발급할 때와 다른 클라이언트 종류로는 갱신할 수 없다")
    void shouldRejectRefreshFromOtherClientType() {
        IssuedSession issued = sessionIssueService.issueForNewFamily(owner, ClientType.WEB);

        assertThatThrownBy(() -> sessionRefreshService.refresh(issued.refreshToken(), ClientType.NATIVE))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.REFRESH_SESSION_INVALID);
    }

    @Test
    @DisplayName("저장된 적 없는 refresh token은 거절한다")
    void shouldRejectUnknownRefreshToken() {
        assertThatThrownBy(() -> sessionRefreshService.refresh("unknown-token", ClientType.WEB))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.REFRESH_SESSION_INVALID);
    }

    @Test
    @DisplayName("로그아웃하면 그 기기 계열만 끊는다")
    void shouldRevokeOnlyOwnFamilyOnLogOut() {
        IssuedSession web = sessionIssueService.issueForNewFamily(owner, ClientType.WEB);
        IssuedSession mobile = sessionIssueService.issueForNewFamily(owner, ClientType.NATIVE);

        sessionRefreshService.revokeSession(web.refreshToken());

        assertThatThrownBy(() -> sessionRefreshService.refresh(web.refreshToken(), ClientType.WEB))
                .isInstanceOf(BusinessException.class);
        assertThat(sessionRefreshService.refresh(mobile.refreshToken(), ClientType.NATIVE)).isNotNull();
    }

    @Test
    @DisplayName("가입이 끝나지 않은 회원에게는 약관 동의가 필요하다고 알린다")
    void shouldMarkTermsAgreementRequiredForPendingUser() {
        UserResult pending = userService.createPendingUser("pending", null);
        UserAuthInfo pendingOwner =
                new UserAuthInfo(pending.id(), pending.status(), pending.role(), pending.nickname(), pending.email());

        IssuedSession issued = sessionIssueService.issueForNewFamily(pendingOwner, ClientType.WEB);

        assertThat(issued.termsAgreementRequired()).isTrue();
    }
}
