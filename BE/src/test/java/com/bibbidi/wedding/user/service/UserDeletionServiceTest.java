package com.bibbidi.wedding.user.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;

import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import com.bibbidi.wedding.auth.password.PasswordHasher;
import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.repository.ChecklistItemRepository;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserDeletionServiceTest {

    private static final Long USER_ID = 1L;
    private static final Long CHECKLIST_ID = 10L;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ChecklistRepository checklistRepository;

    @Mock
    private ChecklistItemRepository checklistItemRepository;

    @Mock
    private AppointmentRepository appointmentRepository;

    @Mock
    private PasswordHasher passwordHasher;

    private UserDeletionService userDeletionService;

    @BeforeEach
    void setUp() {
        userDeletionService = new UserDeletionService(
                userRepository,
                checklistRepository,
                checklistItemRepository,
                appointmentRepository,
                passwordHasher
        );
    }

    @Test
    @DisplayName("현재 비밀번호를 확인하고 일정, 할 일, 체크리스트, 사용자 순서로 삭제한다")
    void shouldVerifyPasswordAndDeleteOwnedDataInOrder() {
        User user = new User(USER_ID, "bibbidi", "password-hash");
        Checklist checklist = new Checklist(CHECKLIST_ID, USER_ID);
        List<Long> checklistItemIds = List.of(100L, 101L);
        given(userRepository.findById(USER_ID)).willReturn(user);
        given(passwordHasher.matches("wish", "password-hash")).willReturn(true);
        given(checklistRepository.findByOwnerId(USER_ID)).willReturn(Optional.of(checklist));
        given(checklistItemRepository.findIdsByChecklistId(CHECKLIST_ID)).willReturn(checklistItemIds);

        userDeletionService.delete(USER_ID, "wish");

        InOrder order = inOrder(
                userRepository,
                passwordHasher,
                checklistRepository,
                checklistItemRepository,
                appointmentRepository
        );
        order.verify(userRepository).findById(USER_ID);
        order.verify(passwordHasher).matches("wish", "password-hash");
        order.verify(checklistRepository).findByOwnerId(USER_ID);
        order.verify(checklistItemRepository).findIdsByChecklistId(CHECKLIST_ID);
        order.verify(appointmentRepository).deleteAllByChecklistItemIds(checklistItemIds);
        order.verify(checklistItemRepository).deleteAllByChecklistId(CHECKLIST_ID);
        order.verify(checklistRepository).deleteById(CHECKLIST_ID);
        order.verify(userRepository).deleteById(USER_ID);
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자는 사용자만 삭제한다")
    void shouldDeleteOnlyUserWhenChecklistDoesNotExist() {
        User user = new User(USER_ID, "bibbidi", "password-hash");
        given(userRepository.findById(USER_ID)).willReturn(user);
        given(passwordHasher.matches("wish", "password-hash")).willReturn(true);
        given(checklistRepository.findByOwnerId(USER_ID)).willReturn(Optional.empty());

        userDeletionService.delete(USER_ID, "wish");

        then(appointmentRepository).shouldHaveNoInteractions();
        then(checklistItemRepository).shouldHaveNoInteractions();
        then(checklistRepository).should(never()).deleteById(CHECKLIST_ID);
        then(userRepository).should().deleteById(USER_ID);
    }

    @Test
    @DisplayName("일정이 없는 체크리스트는 빈 ID 목록으로 일정 삭제 쿼리를 호출하지 않는다")
    void shouldSkipAppointmentDeletionWhenChecklistHasNoItems() {
        User user = new User(USER_ID, "bibbidi", "password-hash");
        Checklist checklist = new Checklist(CHECKLIST_ID, USER_ID);
        given(userRepository.findById(USER_ID)).willReturn(user);
        given(passwordHasher.matches("wish", "password-hash")).willReturn(true);
        given(checklistRepository.findByOwnerId(USER_ID)).willReturn(Optional.of(checklist));
        given(checklistItemRepository.findIdsByChecklistId(CHECKLIST_ID)).willReturn(List.of());

        userDeletionService.delete(USER_ID, "wish");

        then(appointmentRepository).shouldHaveNoInteractions();
        then(checklistItemRepository).should().deleteAllByChecklistId(CHECKLIST_ID);
        then(checklistRepository).should().deleteById(CHECKLIST_ID);
        then(userRepository).should().deleteById(USER_ID);
    }

    @Test
    @DisplayName("비밀번호가 일치하지 않으면 어떤 데이터도 삭제하지 않는다")
    void shouldNotDeleteAnythingWhenPasswordDoesNotMatch() {
        User user = new User(USER_ID, "bibbidi", "password-hash");
        given(userRepository.findById(USER_ID)).willReturn(user);
        given(passwordHasher.matches("wrong-password", "password-hash")).willReturn(false);

        assertThatThrownBy(() -> userDeletionService.delete(USER_ID, "wrong-password"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.AUTHENTICATION_FAILED);

        then(checklistRepository).shouldHaveNoInteractions();
        then(checklistItemRepository).shouldHaveNoInteractions();
        then(appointmentRepository).shouldHaveNoInteractions();
        then(userRepository).should(never()).deleteById(USER_ID);
    }

    @Test
    @DisplayName("Session 사용자 ID에 해당하는 사용자가 없으면 사용자 없음 오류를 유지한다")
    void shouldReturnUserNotFoundWhenCurrentUserDoesNotExist() {
        given(userRepository.findById(USER_ID)).willThrow(
                new BusinessException(ClientError.USER_NOT_FOUND, "사용자 조회 실패")
        );

        assertThatThrownBy(() -> userDeletionService.delete(USER_ID, "wish"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.USER_NOT_FOUND);

        then(passwordHasher).shouldHaveNoInteractions();
        then(checklistRepository).shouldHaveNoInteractions();
        then(checklistItemRepository).shouldHaveNoInteractions();
        then(appointmentRepository).shouldHaveNoInteractions();
    }
}
