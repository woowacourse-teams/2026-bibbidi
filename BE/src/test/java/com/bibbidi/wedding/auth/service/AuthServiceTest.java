package com.bibbidi.wedding.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.bibbidi.wedding.auth.password.PasswordHasher;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserAuthenticationInfo;
import com.bibbidi.wedding.user.service.UserCreationResult;
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
        UserCreationResult creationResult = new UserCreationResult(1L, "비비디");
        given(passwordHasher.hash("password")).willReturn("password-hash");
        given(userService.createUser("비비디", "password-hash")).willReturn(creationResult);

        UserCreationResult result = authService.register("비비디", "password");

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
}
