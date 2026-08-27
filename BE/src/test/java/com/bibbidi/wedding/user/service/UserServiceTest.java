package com.bibbidi.wedding.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserRepository;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
        User user = User.restore(1L, "Bibbidi", "password-hash");
        given(userRepository.findById(1L)).willReturn(user);
        given(userRepository.existsByNicknameExcludingUser("bibbidi", 1L)).willReturn(false);

        NicknameChangeResult result = userService.changeNickname(1L, "bibbidi");

        assertThat(result).isEqualTo(new NicknameChangeResult(1L, "bibbidi"));
        then(userRepository).should().existsByNicknameExcludingUser("bibbidi", 1L);
        then(userRepository).should().updateNickname(1L, "bibbidi");
    }

    @Test
    @DisplayName("현재 닉네임과 정확히 같으면 저장하지 않고 현재 정보를 반환한다")
    void shouldReturnCurrentUserWithoutSavingWhenNicknameIsExactlySame() {
        User user = User.restore(1L, "Bibbidi", "password-hash");
        given(userRepository.findById(1L)).willReturn(user);

        NicknameChangeResult result = userService.changeNickname(1L, "Bibbidi");

        assertThat(result).isEqualTo(new NicknameChangeResult(1L, "Bibbidi"));
        then(userRepository).should(never()).existsByNicknameExcludingUser("Bibbidi", 1L);
        then(userRepository).should(never()).updateNickname(1L, "Bibbidi");
    }

    @Test
    @DisplayName("다른 사용자가 대소문자만 다른 닉네임을 사용하면 변경하지 않는다")
    void shouldRejectWithoutUpdatingWhenAnotherUserHasNicknameIgnoringCase() {
        User user = User.restore(1L, "current", "password-hash");
        given(userRepository.findById(1L)).willReturn(user);
        given(userRepository.existsByNicknameExcludingUser("TAKEN", 1L)).willReturn(true);

        assertThatThrownBy(() -> userService.changeNickname(1L, "TAKEN"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DUPLICATE_NICKNAME);

        then(userRepository).should(never()).updateNickname(1L, "TAKEN");
    }

    @Test
    @DisplayName("Session의 사용자 ID로 사용자를 찾을 수 없으면 인증 필요 오류를 반환한다")
    void shouldRequireAuthenticationWhenSessionUserDoesNotExist() {
        given(userRepository.findById(1L)).willThrow(new NoSuchElementException());

        assertThatThrownBy(() -> userService.changeNickname(1L, "new-name"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.AUTHENTICATION_REQUIRED);
    }
}
