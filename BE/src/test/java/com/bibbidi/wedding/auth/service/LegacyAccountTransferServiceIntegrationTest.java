package com.bibbidi.wedding.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.verification.VerifiedOidcUser;
import com.bibbidi.wedding.auth.service.dto.IssuedSession;
import com.bibbidi.wedding.auth.service.dto.UserAuthInfo;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.terms.service.TermsService;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import com.bibbidi.wedding.user.service.dto.PasswordLoginInfo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Sql("/legacy-account-fixture.sql")
class LegacyAccountTransferServiceIntegrationTest {

    private static final String LEGACY_NICKNAME = "기존회원";
    private static final String LEGACY_PASSWORD = "bibbidi1234";
    private static final String TERMS_VERSION = "v1";
    private static final Long REQUIRED_SERVICE_TERMS_ID = 1L;
    private static final Long REQUIRED_PRIVACY_TERMS_ID = 2L;
    private static final VerifiedOidcUser KAKAO_USER = new VerifiedOidcUser(
            SocialProvider.KAKAO, "social-user-1", LEGACY_NICKNAME, "new@bibbidi.kr");
    private static final VerifiedOidcUser GOOGLE_USER = new VerifiedOidcUser(
            SocialProvider.GOOGLE, "social-user-2", LEGACY_NICKNAME, "other@bibbidi.kr");

    @Autowired
    private LegacyAccountTransferService legacyAccountTransferService;

    @Autowired
    private SocialUserRegistrationService socialUserRegistrationService;

    @Autowired
    private TermsAgreementService termsAgreementService;

    @Autowired
    private SessionIssueService sessionIssueService;

    @Autowired
    private SessionRefreshService sessionRefreshService;

    @Autowired
    private TermsService termsService;

    @Autowired
    private UserService userService;

    @Test
    @DisplayName("옮기면 소셜 계정이 기존 회원으로 로그인되고 새로 생긴 회원은 지워진다")
    void shouldMoveSocialAccountToLegacyUser() {
        PasswordLoginInfo legacyAccount = userService.findPasswordLoginInfo(LEGACY_NICKNAME).orElseThrow();
        UserAuthInfo socialUser = socialUserRegistrationService.findOrCreate(KAKAO_USER);

        legacyAccountTransferService.transfer(socialUser.userId(), LEGACY_NICKNAME, LEGACY_PASSWORD);

        UserAuthInfo loggedIn = socialUserRegistrationService.findOrCreate(KAKAO_USER);
        assertThat(loggedIn.userId()).isEqualTo(legacyAccount.userId());
        assertThatThrownBy(() -> userService.findCurrentUserInfo(socialUser.userId()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("한 번 옮긴 기존 회원은 같은 닉네임과 비밀번호로 다시 옮길 수 없다")
    void shouldRejectSecondTransferOfSameLegacyUser() {
        UserAuthInfo socialUser = socialUserRegistrationService.findOrCreate(KAKAO_USER);
        legacyAccountTransferService.transfer(socialUser.userId(), LEGACY_NICKNAME, LEGACY_PASSWORD);
        UserAuthInfo otherSocialUser = socialUserRegistrationService.findOrCreate(GOOGLE_USER);

        assertThatThrownBy(() -> legacyAccountTransferService.transfer(
                otherSocialUser.userId(), LEGACY_NICKNAME, LEGACY_PASSWORD))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.AUTHENTICATION_FAILED);
    }

    @Test
    @Sql({"/legacy-account-fixture.sql", "/terms-fixture.sql"})
    @DisplayName("옮기면 소셜 회원으로 동의한 약관이 기존 회원의 동의로 옮겨진다")
    void shouldMoveTermsAgreementToLegacyUser() {
        PasswordLoginInfo legacyAccount = userService.findPasswordLoginInfo(LEGACY_NICKNAME).orElseThrow();
        UserAuthInfo socialUser = socialUserRegistrationService.findOrCreate(KAKAO_USER);
        termsAgreementService.agree(socialUser.userId(), TERMS_VERSION, true);

        legacyAccountTransferService.transfer(socialUser.userId(), LEGACY_NICKNAME, LEGACY_PASSWORD);

        UserResult legacyUser = userService.findCurrentUserInfo(legacyAccount.userId());
        assertThat(termsService.findAgreedTermsIds(legacyAccount.userId()))
                .containsExactlyInAnyOrder(REQUIRED_SERVICE_TERMS_ID, REQUIRED_PRIVACY_TERMS_ID);
        assertThat(termsService.findAgreedTermsIds(socialUser.userId())).isEmpty();
        assertThat(legacyUser.termsVersion()).isEqualTo(TERMS_VERSION);
        assertThat(legacyUser.termsAgreedAt()).isNotNull();
    }

    @Test
    @DisplayName("옮기면 소셜 회원으로 받은 refresh token으로는 더 이상 갱신할 수 없다")
    void shouldRevokeSocialUserSessions() {
        UserAuthInfo socialUser = socialUserRegistrationService.findOrCreate(KAKAO_USER);
        IssuedSession socialSession = sessionIssueService.issueForNewFamily(socialUser, ClientType.WEB);

        legacyAccountTransferService.transfer(socialUser.userId(), LEGACY_NICKNAME, LEGACY_PASSWORD);

        assertThatThrownBy(() -> sessionRefreshService.refresh(socialSession.refreshToken(), ClientType.WEB))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.REFRESH_SESSION_INVALID);
    }
}
