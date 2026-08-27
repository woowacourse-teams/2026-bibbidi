package com.bibbidi.wedding.appointment.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AppointmentTest {

    private static final Long CHECKLIST_ITEM_ID = 1L;
    private static final LocalDate DATE = LocalDate.of(2026, 9, 1);
    private static final LocalDateTime START = LocalDateTime.of(2026, 9, 1, 10, 0);
    private static final LocalDateTime END = LocalDateTime.of(2026, 9, 1, 11, 0);

    private static Appointment constructTestAppointment(boolean isDone) {
        return new Appointment(
                null,
                CHECKLIST_ITEM_ID,
                "Consultation",
                DATE,
                START,
                END,
                "Wedding hall",
                "Preparation",
                isDone
        );
    }

    @Test
    @DisplayName("완료하면 완료 상태가 된다")
    void shouldBeDoneWhenCompleted() {
        // given
        Appointment appointment = constructTestAppointment(false);

        // when
        Appointment completed = appointment.complete();

        // then
        assertThat(completed.isDone()).isTrue();
    }

    @Test
    @DisplayName("완료된 일정의 완료를 취소하면 미완료 상태가 된다")
    void shouldNotBeDoneWhenReopened() {
        // given
        Appointment appointment = constructTestAppointment(true);

        // when
        Appointment reopened = appointment.reopen();

        // then
        assertThat(reopened.isDone()).isFalse();
    }

    @Test
    @DisplayName("수정해도 완료 상태는 유지된다")
    void shouldPreserveDoneStatusWhenUpdated() {
        Appointment appointment = constructTestAppointment(true);

        Appointment updated = appointment.update(
                "Updated consultation",
                LocalDate.of(2026, 10, 1),
                null,
                null,
                null,
                null
        );

        assertThat(updated)
                .extracting(
                        Appointment::id,
                        Appointment::checklistItemId,
                        Appointment::title,
                        Appointment::date,
                        Appointment::startTime,
                        Appointment::endTime,
                        Appointment::place,
                        Appointment::memo,
                        Appointment::isDone
                )
                .containsExactly(
                        appointment.id(),
                        CHECKLIST_ITEM_ID,
                        "Updated consultation",
                        LocalDate.of(2026, 10, 1),
                        null,
                        null,
                        null,
                        null,
                        true
                );
    }
}
