package com.bibbidi.wedding.appointment.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentEntity;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
@Import({AppointmentRepository.class, AppointmentMapper.class})
class AppointmentRepositoryTest {

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private JpaAppointmentRepository jpaAppointmentRepository;

    @Test
    @DisplayName("Appointment을 저장하면 생성된 ID와 도메인 정보가 반환된다")
    void shouldSaveAppointmentAndReturnPersistedDomain() {
        // given
        Appointment appointment = new Appointment(
                null,
                1L,
                "웨딩홀 상담",
                LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, 10, 0),
                LocalDateTime.of(2026, 9, 1, 11, 0),
                "웨딩홀",
                "상담 준비",
                false
        );

        // when
        Appointment saved = appointmentRepository.save(appointment);

        // then
        assertThat(saved.id()).isNotNull();
        assertThat(jpaAppointmentRepository.findById(saved.id()))
                .isPresent()
                .get()
                .extracting(
                        JpaAppointmentEntity::checklistItemId,
                        JpaAppointmentEntity::title,
                        JpaAppointmentEntity::date,
                        JpaAppointmentEntity::startTime,
                        JpaAppointmentEntity::endTime,
                        JpaAppointmentEntity::place,
                        JpaAppointmentEntity::memo,
                        JpaAppointmentEntity::isDone
                )
                .containsExactly(
                        1L,
                        "웨딩홀 상담",
                        LocalDate.of(2026, 9, 1),
                        LocalDateTime.of(2026, 9, 1, 10, 0),
                        LocalDateTime.of(2026, 9, 1, 11, 0),
                        "웨딩홀",
                        "상담 준비",
                        false
                );
    }

    @Test
    @DisplayName("지정한 할 일들에 속한 일정만 모두 삭제한다")
    void shouldDeleteOnlyAppointmentsOfGivenChecklistItems() {
        Appointment firstTarget = saveAppointment(10L, "첫 번째 대상 일정");
        Appointment secondTarget = saveAppointment(11L, "두 번째 대상 일정");
        Appointment other = saveAppointment(20L, "다른 일정");

        int deletedCount = appointmentRepository.deleteAllByChecklistItemIds(List.of(10L, 11L));

        assertThat(deletedCount).isEqualTo(2);
        assertThat(jpaAppointmentRepository.findById(firstTarget.id())).isEmpty();
        assertThat(jpaAppointmentRepository.findById(secondTarget.id())).isEmpty();
        assertThat(jpaAppointmentRepository.findById(other.id())).isPresent();
    }

    private Appointment saveAppointment(Long checklistItemId, String title) {
        return appointmentRepository.save(new Appointment(
                null,
                checklistItemId,
                title,
                LocalDate.of(2026, 9, 1),
                null,
                null,
                null,
                null,
                false
        ));
    }
}
