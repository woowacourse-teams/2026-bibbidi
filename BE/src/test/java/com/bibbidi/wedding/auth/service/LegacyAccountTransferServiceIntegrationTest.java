package com.bibbidi.wedding.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.verification.VerifiedOidcUser;
import com.bibbidi.wedding.auth.service.dto.UserAuthInfo;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
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
    private static final VerifiedOidcUser KAKAO_USER = new VerifiedOidcUser(
            SocialProvider.KAKAO, "social-user-1", LEGACY_NICKNAME, "new@bibbidi.kr");
    private static final VerifiedOidcUser GOOGLE_USER = new VerifiedOidcUser(
            SocialProvider.GOOGLE, "social-user-2", LEGACY_NICKNAME, "other@bibbidi.kr");

    @Autowired
    private LegacyAccountTransferService legacyAccountTransferService;

    @Autowired
    private SocialUserRegistrationService socialUserRegistrationService;

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
}
