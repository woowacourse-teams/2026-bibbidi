package com.bibbidi.wedding.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository);
    }

    @Test
    @DisplayName("대소문자만 다른 닉네임도 요청한 표기로 변경한다")
    void shouldChangeNicknameWhenOnlyLetterCaseDiffers() {
        User user = new User(1L, "Bibbidi", "password-hash");
        given(userRepository.findById(1L)).willReturn(user);

        UserResult result = userService.changeNickname(1L, "bibbidi");

        assertThat(result).isEqualTo(new UserResult(1L, "bibbidi"));
        then(userRepository).should().updateNickname(1L, "bibbidi");
    }

    @Test
    @DisplayName("현재 닉네임과 정확히 같으면 저장하지 않고 현재 정보를 반환한다")
    void shouldReturnCurrentUserWithoutSavingWhenNicknameIsExactlySame() {
        User user = new User(1L, "Bibbidi", "password-hash");
        given(userRepository.findById(1L)).willReturn(user);

        UserResult result = userService.changeNickname(1L, "Bibbidi");

        assertThat(result).isEqualTo(new UserResult(1L, "Bibbidi"));
        then(userRepository).should(never()).updateNickname(1L, "Bibbidi");
    }

    @Test
    @DisplayName("다른 사용자가 이미 사용하는 닉네임이면 변경을 거절한다")
    void shouldRejectWhenAnotherUserAlreadyHasNickname() {
        User user = new User(1L, "current", "password-hash");
        given(userRepository.findById(1L)).willReturn(user);
        willThrow(new DataIntegrityViolationException("uk_users_nickname"))
                .given(userRepository).updateNickname(1L, "TAKEN");

        assertThatThrownBy(() -> userService.changeNickname(1L, "TAKEN"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DUPLICATE_NICKNAME);
    }

    @Test
    @DisplayName("Session의 사용자 ID로 사용자를 찾을 수 없으면 인증 필요 오류를 반환한다")
    void shouldRequireAuthenticationWhenSessionUserDoesNotExist() {
        given(userRepository.findById(1L)).willThrow(
                new BusinessException(ClientError.USER_NOT_FOUND, "사용자 조회 실패")
        );

        assertThatThrownBy(() -> userService.changeNickname(1L, "new-name"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.AUTHENTICATION_REQUIRED);
    }

    @Test
    @DisplayName("사용 중이지 않은 닉네임은 사용할 수 있다고 응답한다")
    void shouldReportNicknameAsAvailableWhenNobodyUsesIt() {
        given(userRepository.existsByNickname("bibbidi")).willReturn(false);

        NicknameAvailabilityResult result = userService.checkNicknameAvailability("bibbidi");

        assertThat(result).isEqualTo(new NicknameAvailabilityResult("bibbidi", true));
    }

    @Test
    @DisplayName("이미 사용 중인 닉네임은 사용할 수 없다고 응답한다")
    void shouldReportNicknameAsUnavailableWhenSomebodyUsesIt() {
        given(userRepository.existsByNickname("bibbidi")).willReturn(true);

        NicknameAvailabilityResult result = userService.checkNicknameAvailability("bibbidi");

        assertThat(result).isEqualTo(new NicknameAvailabilityResult("bibbidi", false));
    }

    @Test
    @DisplayName("이미 사용 중인 닉네임으로는 회원가입을 거절한다")
    void shouldRejectRegistrationWhenNicknameIsAlreadyTaken() {
        given(userRepository.save(any(User.class)))
                .willThrow(new DataIntegrityViolationException("uk_users_nickname"));

        assertThatThrownBy(() -> userService.createUser("bibbidi", "password-hash"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DUPLICATE_NICKNAME);
    }

    @Test
    @DisplayName("현재 사용자의 비밀번호 해시를 저장한다")
    void shouldUpdateCurrentUserPasswordHash() {
        userService.updatePasswordHash(1L, "new-password-hash");

        then(userRepository).should().updatePasswordHash(1L, "new-password-hash");
    }
}
