package com.bibbidi.wedding.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;

import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.domain.WeddingDate;
import com.bibbidi.wedding.user.repository.UserRepository;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    private static final Long USER_ID = 1L;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ChecklistService checklistService;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, checklistService);
    }

    @Test
    @DisplayName("소셜 인증만 끝난 회원은 아직 서비스를 쓸 수 없는 상태로 만든다")
    void shouldCreatePendingUser() {
        given(userRepository.create(any(User.class)))
                .willReturn(new User(USER_ID, "current", UserStatus.PENDING, UserRole.NORMAL, "current@bibbidi.kr"));

        UserResult created = userService.createPendingUser("current", "current@bibbidi.kr");

        assertThat(created)
                .extracting(UserResult::id, UserResult::nickname, UserResult::status, UserResult::email)
                .containsExactly(USER_ID, "current", UserStatus.PENDING, "current@bibbidi.kr");
        then(userRepository).should()
                .create(argThat(user -> user.status() == UserStatus.PENDING && user.id() == null));
    }

    @Test
    @DisplayName("가입이 끝나지 않은 회원을 활성화한다")
    void shouldActivatePendingUser() {
        given(userRepository.findById(USER_ID))
                .willReturn(new User(USER_ID, "current", UserStatus.PENDING, UserRole.NORMAL, null));
        given(userRepository.update(any(User.class)))
                .willReturn(new User(USER_ID, "current", UserStatus.ACTIVE, UserRole.NORMAL, null));

        UserResult activated = userService.activate(USER_ID);

        assertThat(activated.status()).isEqualTo(UserStatus.ACTIVE);
        then(userRepository).should().update(argThat(User::isActive));
    }

    @Test
    @DisplayName("이미 활성화된 회원은 다시 저장하지 않는다")
    void shouldNotUpdateAlreadyActiveUser() {
        given(userRepository.findById(USER_ID))
                .willReturn(new User(USER_ID, "current", UserStatus.ACTIVE, UserRole.NORMAL, null));

        UserResult result = userService.activate(USER_ID);

        assertThat(result.status()).isEqualTo(UserStatus.ACTIVE);
        then(userRepository).should(never()).update(any(User.class));
    }

    @Test
    @DisplayName("현재 사용자 정보 조회 시 DB에 사용자가 없으면 사용자 없음 오류를 유지한다")
    void shouldKeepUserNotFoundWhenFindingCurrentUser() {
        given(userRepository.findById(USER_ID))
                .willThrow(new BusinessException(ClientError.USER_NOT_FOUND, "없음"));

        assertThatThrownBy(() -> userService.findCurrentUserInfo(USER_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("대소문자만 다른 닉네임도 요청한 표기로 변경한다")
    void shouldChangeNicknameCase() {
        given(userRepository.findById(USER_ID))
                .willReturn(new User(USER_ID, "current", UserStatus.ACTIVE, UserRole.NORMAL, null));
        given(userRepository.update(any(User.class)))
                .willReturn(new User(USER_ID, "CURRENT", UserStatus.ACTIVE, UserRole.NORMAL, null));

        UserResult changed = userService.changeNickname(USER_ID, "CURRENT");

        assertThat(changed.nickname()).isEqualTo("CURRENT");
    }

    @Test
    @DisplayName("현재 닉네임과 정확히 같으면 저장하지 않고 현재 정보를 반환한다")
    void shouldNotUpdateWhenNicknameIsSame() {
        given(userRepository.findById(USER_ID))
                .willReturn(new User(USER_ID, "current", UserStatus.ACTIVE, UserRole.NORMAL, null));

        UserResult result = userService.changeNickname(USER_ID, "current");

        assertThat(result.nickname()).isEqualTo("current");
        then(userRepository).should(never()).update(any(User.class));
    }

    @Test
    @DisplayName("쓰지 않는 닉네임은 사용할 수 있다고 응답한다")
    void shouldRespondNicknameAvailable() {
        given(userRepository.existsByNickname("magic")).willReturn(false);

        assertThat(userService.checkNicknameAvailability("magic").available()).isTrue();
    }

    @Test
    @DisplayName("이미 쓰는 닉네임은 사용할 수 없다고 응답한다")
    void shouldRespondNicknameUnavailable() {
        given(userRepository.existsByNickname("current")).willReturn(true);

        assertThat(userService.checkNicknameAvailability("current").available()).isFalse();
    }

    @Test
    @DisplayName("현재 사용자의 결혼 예정일을 조회한다")
    void shouldFindWeddingDate() {
        given(userRepository.findWeddingDateByUserId(USER_ID))
                .willReturn(new WeddingDate(USER_ID, LocalDate.of(2027, 5, 15)));

        assertThat(userService.findWeddingDate(USER_ID).weddingDate())
                .isEqualTo(LocalDate.of(2027, 5, 15));
    }

    @Test
    @DisplayName("탈퇴하면 체크리스트를 먼저 지우고 사용자를 지운다")
    void shouldDeleteChecklistBeforeUser() {
        userService.delete(USER_ID);

        InOrder inOrder = inOrder(checklistService, userRepository);
        inOrder.verify(checklistService).deleteByOwnerId(USER_ID);
        inOrder.verify(userRepository).deleteById(USER_ID);
    }
}
