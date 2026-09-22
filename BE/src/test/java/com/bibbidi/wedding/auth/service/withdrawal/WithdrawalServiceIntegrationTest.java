package com.bibbidi.wedding.auth.service.withdrawal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.service.session.IssuedSession;
import com.bibbidi.wedding.auth.service.session.SessionIssueService;
import com.bibbidi.wedding.auth.service.session.SessionOwner;
import com.bibbidi.wedding.auth.service.session.SessionRefreshService;
import com.bibbidi.wedding.auth.token.AccessTokenIssuer;
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
class WithdrawalServiceIntegrationTest {

    @Autowired
    private WithdrawalService withdrawalService;

    @Autowired
    private SessionIssueService sessionIssueService;

    @Autowired
    private SessionRefreshService sessionRefreshService;

    @Autowired
    private AccessTokenIssuer accessTokenIssuer;

    @Autowired
    private UserService userService;

    private SessionOwner owner;

    @BeforeEach
    void setUp() {
        UserResult created = userService.createPendingUser("current", "current@bibbidi.kr");
        UserResult active = userService.activate(created.id());
        owner = new SessionOwner(
                active.id(), active.status(), active.role(), active.nickname(), active.email());
    }

    @Test
    @DisplayName("탈퇴하면 그 회원의 모든 세션을 끊는다")
    void shouldRevokeAllSessionsOnWithdrawal() {
        IssuedSession web = sessionIssueService.issueForNewFamily(owner, ClientType.WEB);
        IssuedSession mobile = sessionIssueService.issueForNewFamily(owner, ClientType.NATIVE);

        withdrawalService.withdraw(owner.userId(), accessTokenIssuer.issueDeleteGrant(owner.userId()));

        assertThatThrownBy(() -> sessionRefreshService.refresh(web.refreshToken(), ClientType.WEB))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> sessionRefreshService.refresh(mobile.refreshToken(), ClientType.NATIVE))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("탈퇴한 회원은 더 이상 조회되지 않는다")
    void shouldDeleteUserOnWithdrawal() {
        withdrawalService.withdraw(owner.userId(), accessTokenIssuer.issueDeleteGrant(owner.userId()));

        assertThatThrownBy(() -> userService.findCurrentUserInfo(owner.userId()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("다른 회원의 탈퇴 표로는 탈퇴할 수 없다")
    void shouldRejectDeleteGrantOfOtherUser() {
        UserResult other = userService.createPendingUser("other", null);
        String otherGrant = accessTokenIssuer.issueDeleteGrant(other.id());

        assertThatThrownBy(() -> withdrawalService.withdraw(owner.userId(), otherGrant))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DELETE_GRANT_INVALID);

        assertThat(userService.findCurrentUserInfo(owner.userId()).id()).isEqualTo(owner.userId());
    }

    @Test
    @DisplayName("탈퇴 표가 아니면 거절한다")
    void shouldRejectMalformedDeleteGrant() {
        assertThatThrownBy(() -> withdrawalService.withdraw(owner.userId(), "not-a-grant"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DELETE_GRANT_INVALID);
    }
}
