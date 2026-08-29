package com.bibbidi.wedding.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.willThrow;

import com.bibbidi.wedding.appointment.persistence.JpaAppointmentEntity;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentRepository;
import com.bibbidi.wedding.auth.password.PasswordHasher;
import com.bibbidi.wedding.auth.service.AuthService;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.user.persistence.JpaUserEntity;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
import java.time.LocalDate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

@SpringBootTest
@ActiveProfiles("test")
class UserDeletionTransactionIntegrationTest {

    private static final String PASSWORD = "wish";

    @Autowired
    private AuthService authService;

    @Autowired
    private PasswordHasher passwordHasher;

    @Autowired
    private JpaUserRepository jpaUserRepository;

    @Autowired
    private JpaChecklistRepository jpaChecklistRepository;

    @Autowired
    private JpaChecklistItemRepository jpaChecklistItemRepository;

    @Autowired
    private JpaAppointmentRepository jpaAppointmentRepository;

    @MockitoSpyBean
    private ChecklistRepository checklistRepository;

    @AfterEach
    void cleanUp() {
        jpaAppointmentRepository.deleteAllInBatch();
        jpaChecklistItemRepository.deleteAllInBatch();
        jpaChecklistRepository.deleteAllInBatch();
        jpaUserRepository.deleteAllInBatch();
    }

    @Test
    @DisplayName("체크리스트 삭제 중 실패하면 먼저 삭제한 일정과 할 일도 모두 롤백한다")
    void shouldRollbackAllDeletedDataWhenDeletionFails() {
        JpaUserEntity user = jpaUserRepository.saveAndFlush(
                new JpaUserEntity(null, "bibbidi", passwordHasher.hash(PASSWORD))
        );
        JpaChecklistEntity checklist = jpaChecklistRepository.saveAndFlush(
                new JpaChecklistEntity(null, user.id())
        );
        JpaChecklistItemEntity checklistItem = jpaChecklistItemRepository.saveAndFlush(
                new JpaChecklistItemEntity(
                        null,
                        checklist.id(),
                        1L,
                        100L,
                        "계약서 확인",
                        ChecklistItemStatus.PREV
                )
        );
        JpaAppointmentEntity appointment = jpaAppointmentRepository.saveAndFlush(
                new JpaAppointmentEntity(
                        null,
                        checklistItem.id(),
                        "웨딩홀 상담",
                        LocalDate.of(2026, 9, 1),
                        null,
                        null,
                        null,
                        null,
                        false
                )
        );
        willThrow(new IllegalStateException("checklist deletion failed"))
                .given(checklistRepository)
                .deleteById(checklist.id());

        assertThatThrownBy(() -> authService.deleteUser(user.id(), PASSWORD))
                .isInstanceOf(DataAccessException.class)
                .hasRootCauseInstanceOf(IllegalStateException.class)
                .hasRootCauseMessage("checklist deletion failed");

        assertThat(jpaUserRepository.findById(user.id())).isPresent();
        assertThat(jpaChecklistRepository.findById(checklist.id())).isPresent();
        assertThat(jpaChecklistItemRepository.findById(checklistItem.id())).isPresent();
        assertThat(jpaAppointmentRepository.findById(appointment.id())).isPresent();
    }
}
