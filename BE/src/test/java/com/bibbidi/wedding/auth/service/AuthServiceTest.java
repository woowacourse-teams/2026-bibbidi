package com.bibbidi.wedding.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

import com.bibbidi.wedding.auth.password.PasswordHasher;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserAuthenticationInfo;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserService userService;

    @Mock
    private PasswordHasher passwordHasher;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userService, passwordHasher);
    }

    @Test
    @DisplayName("회원가입 비밀번호를 해시한 뒤 사용자 생성을 요청한다")
    void shouldHashPasswordBeforeCreatingUser() {
        UserResult creationResult = new UserResult(1L, "비비디");
        given(passwordHasher.hash("password")).willReturn("password-hash");
        given(userService.createUser("비비디", "password-hash")).willReturn(creationResult);

        UserResult result = authService.register("비비디", "password");

        assertThat(result).isEqualTo(creationResult);
        then(userService).should().createUser("비비디", "password-hash");
    }

    @Test
    @DisplayName("닉네임과 비밀번호가 일치하면 인증 결과를 반환한다")
    void shouldReturnAuthResultWhenCredentialsAreValid() {
        UserAuthenticationInfo user = new UserAuthenticationInfo(1L, "비비디", "password-hash");
        given(userService.findAuthenticationInfo("비비디")).willReturn(user);
        given(passwordHasher.matches("password", "password-hash")).willReturn(true);

        AuthResult result = authService.login("비비디", "password");

        assertThat(result).isEqualTo(new AuthResult(1L, "비비디"));
    }

    @Test
    @DisplayName("존재하지 않는 닉네임은 인증 실패로 처리한다")
    void shouldFailAuthenticationWhenNicknameDoesNotExist() {
        given(userService.findAuthenticationInfo("없는 사용자")).willThrow(new NoSuchElementException());

        assertThatThrownBy(() -> authService.login("없는 사용자", "password"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("로그인 인증에 실패했습니다.")
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.AUTHENTICATION_FAILED);
    }

    @Test
    @DisplayName("잘못된 비밀번호는 사용자 부재와 동일한 인증 실패로 처리한다")
    void shouldFailAuthenticationWhenPasswordDoesNotMatch() {
        UserAuthenticationInfo user = new UserAuthenticationInfo(1L, "비비디", "password-hash");
        given(userService.findAuthenticationInfo("비비디")).willReturn(user);
        given(passwordHasher.matches("wrong-password", "password-hash")).willReturn(false);

        assertThatThrownBy(() -> authService.login("비비디", "wrong-password"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("로그인 인증에 실패했습니다.")
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.AUTHENTICATION_FAILED);
    }

    @Test
    @DisplayName("현재 비밀번호를 확인하고 새 비밀번호를 해시해 저장한다")
    void shouldVerifyAndHashPasswordBeforeUpdating() {
        UserAuthenticationInfo user = new UserAuthenticationInfo(1L, "비비디", "current-hash");
        given(userService.findCurrentUserAuthenticationInfo(1L)).willReturn(user);
        given(passwordHasher.matches("current-password", "current-hash")).willReturn(true);
        given(passwordHasher.hash("new-password")).willReturn("new-hash");

        authService.changePassword(1L, "current-password", "new-password");

        then(passwordHasher).should().matches("current-password", "current-hash");
        then(passwordHasher).should(never()).matches("new-password", "current-hash");
        then(userService).should().changePasswordHash(1L, "new-hash");
    }

    @Test
    @DisplayName("현재 비밀번호가 일치하지 않으면 기존 비밀번호 해시를 유지한다")
    void shouldNotUpdateWhenCurrentPasswordDoesNotMatch() {
        UserAuthenticationInfo user = new UserAuthenticationInfo(1L, "비비디", "current-hash");
        given(userService.findCurrentUserAuthenticationInfo(1L)).willReturn(user);
        given(passwordHasher.matches("wrong-password", "current-hash")).willReturn(false);

        assertThatThrownBy(() -> authService.changePassword(1L, "wrong-password", "new-password"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.AUTHENTICATION_FAILED);

        then(passwordHasher).should(never()).hash("new-password");
        then(userService).should(never()).changePasswordHash(anyLong(), anyString());
    }

    @Test
    @DisplayName("새 비밀번호가 기존 비밀번호와 같으면 저장하지 않고 성공한다")
    void shouldSucceedWithoutUpdatingWhenNewPasswordIsSameAsCurrentPassword() {
        UserAuthenticationInfo user = new UserAuthenticationInfo(1L, "비비디", "current-hash");
        given(userService.findCurrentUserAuthenticationInfo(1L)).willReturn(user);
        given(passwordHasher.matches("current-password", "current-hash")).willReturn(true);

        authService.changePassword(1L, "current-password", "current-password");

        then(passwordHasher).should().matches("current-password", "current-hash");
        then(passwordHasher).should(never()).hash("current-password");
        then(userService).should(never()).changePasswordHash(anyLong(), anyString());
    }

    @Test
    @DisplayName("새 비밀번호 해시에 실패하면 기존 비밀번호 해시를 유지한다")
    void shouldNotUpdateWhenHashingNewPasswordFails() {
        UserAuthenticationInfo user = new UserAuthenticationInfo(1L, "비비디", "current-hash");
        given(userService.findCurrentUserAuthenticationInfo(1L)).willReturn(user);
        given(passwordHasher.matches("current-password", "current-hash")).willReturn(true);
        given(passwordHasher.hash("new-password")).willThrow(new IllegalStateException("hashing failed"));

        assertThatThrownBy(() -> authService.changePassword(1L, "current-password", "new-password"))
                .isInstanceOf(IllegalStateException.class);

        then(passwordHasher).should(never()).matches("new-password", "current-hash");
        then(userService).should(never()).changePasswordHash(anyLong(), anyString());
    }

    @Test
    @DisplayName("현재 비밀번호가 일치하면 사용자 삭제를 요청한다")
    void shouldDeleteUserWhenCurrentPasswordMatches() {
        UserAuthenticationInfo user = new UserAuthenticationInfo(1L, "비비디", "password-hash");
        given(userService.findAuthenticationInfo(1L)).willReturn(user);
        given(passwordHasher.matches("password", "password-hash")).willReturn(true);

        authService.deleteUser(1L, "password");

        then(userService).should().delete(1L);
    }

    @Test
    @DisplayName("현재 비밀번호가 일치하지 않으면 사용자 삭제를 요청하지 않는다")
    void shouldNotDeleteUserWhenCurrentPasswordDoesNotMatch() {
        UserAuthenticationInfo user = new UserAuthenticationInfo(1L, "비비디", "password-hash");
        given(userService.findAuthenticationInfo(1L)).willReturn(user);
        given(passwordHasher.matches("wrong-password", "password-hash")).willReturn(false);

        assertThatThrownBy(() -> authService.deleteUser(1L, "wrong-password"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.AUTHENTICATION_FAILED);

        then(userService).should(never()).delete(anyLong());
    }

    @Test
    @DisplayName("탈퇴할 사용자가 없으면 사용자 없음 오류를 유지한다")
    void shouldKeepUserNotFoundWhenDeletingMissingUser() {
        given(userService.findAuthenticationInfo(1L)).willThrow(
                new BusinessException(ClientError.USER_NOT_FOUND, "사용자 조회 실패")
        );

        assertThatThrownBy(() -> authService.deleteUser(1L, "password"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.USER_NOT_FOUND);

        then(passwordHasher).shouldHaveNoInteractions();
        then(userService).should(never()).delete(anyLong());
    }
}
