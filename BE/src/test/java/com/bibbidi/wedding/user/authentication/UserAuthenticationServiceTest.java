package com.bibbidi.wedding.user.authentication;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserRepository;
import com.bibbidi.wedding.user.service.PasswordHasher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserAuthenticationServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordHasher passwordHasher;

    private UserAuthenticationService userAuthenticationService;

    @BeforeEach
    void setUp() {
        userAuthenticationService = new UserAuthenticationService(userRepository, passwordHasher);
    }

    @Test
    @DisplayName("닉네임과 비밀번호가 일치하면 인증된 사용자 정보만 반환한다")
    void shouldReturnAuthenticatedUserWhenCredentialsAreValid() {
        User user = User.restore(1L, "비비디", "password-hash");
        given(userRepository.findByNickname("비비디")).willReturn(user);
        given(passwordHasher.matches("password", "password-hash")).willReturn(true);

        AuthenticatedUser result = userAuthenticationService.authenticate("비비디", "password");

        assertThat(result).isEqualTo(new AuthenticatedUser(1L, "비비디"));
    }

    @Test
    @DisplayName("존재하지 않는 닉네임은 인증 실패로 처리한다")
    void shouldFailAuthenticationWhenNicknameDoesNotExist() {
        given(userRepository.findByNickname("없는 사용자")).willThrow(new BusinessException(
                ClientError.AUTHENTICATION_FAILED,
                "로그인 인증에 실패했습니다."
        ));

        assertThatThrownBy(() -> userAuthenticationService.authenticate("없는 사용자", "password"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("로그인 인증에 실패했습니다.")
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.AUTHENTICATION_FAILED);
    }

    @Test
    @DisplayName("잘못된 비밀번호는 사용자 부재와 동일한 인증 실패로 처리한다")
    void shouldFailAuthenticationWhenPasswordDoesNotMatch() {
        User user = User.restore(1L, "비비디", "password-hash");
        given(userRepository.findByNickname("비비디")).willReturn(user);
        given(passwordHasher.matches("wrong-password", "password-hash")).willReturn(false);

        assertThatThrownBy(() -> userAuthenticationService.authenticate("비비디", "wrong-password"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("로그인 인증에 실패했습니다.")
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.AUTHENTICATION_FAILED);
    }
}
