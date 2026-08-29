package com.bibbidi.wedding.appointment.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
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

    @Test
    @DisplayName("시작 시각과 종료 시각이 모두 없거나 한쪽만 있으면 선후 검증을 하지 않는다")
    void shouldAllowPartiallySpecifiedTime() {
        assertThatCode(() -> appointmentWithTime(null, null)).doesNotThrowAnyException();
        assertThatCode(() -> appointmentWithTime(START, null)).doesNotThrowAnyException();
        assertThatCode(() -> appointmentWithTime(null, END)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("시작 시각과 종료 시각이 같은 0분짜리 일정도 허용한다")
    void shouldAllowZeroLengthTime() {
        assertThatCode(() -> appointmentWithTime(START, START)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("시작 시각이 종료 시각보다 늦으면 생성할 수 없다")
    void shouldRejectReversedTimeWhenBothSpecified() {
        assertThatCode(() -> appointmentWithTime(START, END)).doesNotThrowAnyException();
        assertThatThrownBy(() -> appointmentWithTime(END, START))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.INVALID_APPOINTMENT_TIME_RANGE);
    }

    @Test
    @DisplayName("시간이 겹치는 일정끼리는 충돌이다")
    void shouldConflictWhenTimesOverlap() {
        assertThat(at(10, 0, 11, 0).conflictsWith(at(10, 30, 11, 30))).isTrue();
        assertThat(at(10, 30, 11, 30).conflictsWith(at(10, 0, 11, 0))).isTrue();
    }

    @Test
    @DisplayName("끝나는 시각과 시작 시각만 맞닿은 일정은 충돌이 아니다")
    void shouldNotConflictWhenOnlyTouchingAtBoundary() {
        assertThat(at(10, 0, 11, 0).conflictsWith(at(11, 0, 12, 0))).isFalse();
        assertThat(at(11, 0, 12, 0).conflictsWith(at(10, 0, 11, 0))).isFalse();
    }

    @Test
    @DisplayName("시간이 전혀 겹치지 않으면 충돌이 아니다")
    void shouldNotConflictWhenTimesAreApart() {
        assertThat(at(10, 0, 11, 0).conflictsWith(at(13, 0, 14, 0))).isFalse();
    }

    @Test
    @DisplayName("0분짜리 일정이 상대 일정 구간 안에 있으면 충돌이다")
    void shouldConflictWhenInstantFallsInsideOtherAppointment() {
        assertThat(at(11, 0, 11, 0).conflictsWith(at(10, 0, 12, 0))).isTrue();
        assertThat(at(10, 0, 12, 0).conflictsWith(at(11, 0, 11, 0))).isTrue();
    }

    @Test
    @DisplayName("0분짜리 일정이 상대 일정의 경계 시각에 있어도 충돌이다")
    void shouldConflictWhenInstantSitsOnOtherAppointmentBoundary() {
        assertThat(at(10, 0, 10, 0).conflictsWith(at(10, 0, 11, 0))).isTrue();
        assertThat(at(11, 0, 11, 0).conflictsWith(at(10, 0, 11, 0))).isTrue();
    }

    @Test
    @DisplayName("같은 시각의 0분짜리 일정끼리는 충돌이고, 다른 시각이면 충돌이 아니다")
    void shouldConflictBetweenInstantsOnlyAtSameMoment() {
        assertThat(at(11, 0, 11, 0).conflictsWith(at(11, 0, 11, 0))).isTrue();
        assertThat(at(11, 0, 11, 0).conflictsWith(at(12, 0, 12, 0))).isFalse();
    }

    @Test
    @DisplayName("시간이나 장소가 확정되지 않은 일정은 충돌 대상이 아니다")
    void shouldNotConflictWhenScheduleIsNotConfirmed() {
        assertThat(appointmentWithTime(null, null).conflictsWith(at(10, 0, 11, 0))).isFalse();
        assertThat(at(10, 0, 11, 0).conflictsWith(appointmentWithTime(START, null))).isFalse();
        assertThat(at(10, 0, 11, 0).conflictsWith(withoutPlace(at(10, 30, 11, 30)))).isFalse();
    }

    @Test
    @DisplayName("날짜 라벨이 달라도 실제 시각이 겹치면 충돌이다")
    void shouldConflictAcrossDifferentDateLabelsWhenInstantsOverlap() {
        Appointment crossingMidnight = new Appointment(
                null, CHECKLIST_ITEM_ID, "crossing", DATE,
                LocalDateTime.of(2026, 9, 1, 23, 0),
                LocalDateTime.of(2026, 9, 2, 1, 0),
                "Wedding hall", null, false
        );
        Appointment nextDay = new Appointment(
                null, CHECKLIST_ITEM_ID, "next day", DATE.plusDays(1),
                LocalDateTime.of(2026, 9, 2, 0, 30),
                LocalDateTime.of(2026, 9, 2, 2, 0),
                "Wedding hall", null, false
        );

        assertThat(crossingMidnight.conflictsWith(nextDay)).isTrue();
    }

    private static Appointment at(int startHour, int startMinute, int endHour, int endMinute) {
        return appointmentWithTime(
                LocalDateTime.of(2026, 9, 1, startHour, startMinute),
                LocalDateTime.of(2026, 9, 1, endHour, endMinute)
        );
    }

    private static Appointment withoutPlace(Appointment appointment) {
        return new Appointment(
                appointment.id(), appointment.checklistItemId(), appointment.title(), appointment.date(),
                appointment.startTime(), appointment.endTime(), null, appointment.memo(), appointment.isDone()
        );
    }

    private static Appointment appointmentWithTime(LocalDateTime startTime, LocalDateTime endTime) {
        return new Appointment(
                null,
                CHECKLIST_ITEM_ID,
                "Consultation",
                DATE,
                startTime,
                endTime,
                "Wedding hall",
                "Preparation",
                false
        );
    }
}
