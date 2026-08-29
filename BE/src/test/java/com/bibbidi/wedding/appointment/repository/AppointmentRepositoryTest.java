package com.bibbidi.wedding.appointment.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentEntity;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentRepository;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
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

    @Autowired
    private JpaChecklistRepository jpaChecklistRepository;

    @Autowired
    private JpaChecklistItemRepository jpaChecklistItemRepository;

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

    @Test
    void shouldDeleteAppointment() {
        Appointment testAppointment = new Appointment(
                null,
                1L,
                "title",
                LocalDate.of(2026, 9, 1),
                null,
                null,
                null,
                null,
                false
        );
        Appointment saved = appointmentRepository.save(testAppointment);

        appointmentRepository.deleteById(saved.id());

        assertThat(jpaAppointmentRepository.findById(saved.id())).isEmpty();
    }

    @Test
    void shouldChangeChecklistItemIdsInBulk() {
        Appointment first = saveAppointment(1L);
        Appointment second = saveAppointment(1L);
        Appointment untouched = saveAppointment(1L);

        appointmentRepository.changeAllToNewChecklistItemIds(
                2L,
                List.of(first.id(), second.id())
        );

        assertThat(jpaAppointmentRepository.findById(first.id()).orElseThrow().checklistItemId()).isEqualTo(2L);
        assertThat(jpaAppointmentRepository.findById(second.id()).orElseThrow().checklistItemId()).isEqualTo(2L);
        assertThat(jpaAppointmentRepository.findById(untouched.id()).orElseThrow().checklistItemId()).isEqualTo(1L);
    }

    @Test
    void shouldDeleteAppointmentsInBulk() {
        Appointment deleted = saveAppointment(1L);
        Appointment remaining = saveAppointment(1L);

        appointmentRepository.deleteAll(List.of(deleted.id()));

        assertThat(jpaAppointmentRepository.findById(deleted.id())).isEmpty();
        assertThat(jpaAppointmentRepository.findById(remaining.id())).isPresent();
    }

    @Test
    @DisplayName("시간이 겹칠 수 있는 본인 소유 일정만 후보로 조회한다")
    void shouldFindOverlapCandidatesOwnedByUser() {
        JpaChecklistEntity ownChecklist = jpaChecklistRepository.saveAndFlush(new JpaChecklistEntity(null, 1L));
        JpaChecklistEntity otherUsersChecklist = jpaChecklistRepository.saveAndFlush(new JpaChecklistEntity(null, 2L));
        Long firstItemId = saveChecklistItem(ownChecklist.id());
        Long secondItemId = saveChecklistItem(ownChecklist.id());
        Long otherUsersItemId = saveChecklistItem(otherUsersChecklist.id());

        Appointment overlapping = saveAppointment(firstItemId, 11, 0, 12, 0, "overlapping");
        Appointment touching = saveAppointment(secondItemId, 10, 0, 11, 30, "touching");

        saveAppointment(otherUsersItemId, 10, 30, 11, 30, "other user");
        saveAppointment(firstItemId, 13, 0, 14, 0, "apart");
        saveAppointment(firstItemId, null, null, null, null, "no time");

        assertThat(appointmentRepository.findOverlapCandidates(1L, probe(10, 30, 11, 15)))
                .extracting(Appointment::id)
                .containsExactlyInAnyOrder(overlapping.id(), touching.id());
    }

    @Test
    @DisplayName("경계 시각만 맞닿은 일정도 후보에는 포함된다")
    void shouldIncludeBoundaryTouchingAppointmentAsCandidate() {
        Long itemId = saveOwnedChecklistItem();
        Appointment before = saveAppointment(itemId, 10, 0, 11, 0, "before");

        assertThat(appointmentRepository.findOverlapCandidates(1L, probe(11, 0, 12, 0)))
                .extracting(Appointment::id)
                .containsExactly(before.id());
    }

    private Long saveOwnedChecklistItem() {
        JpaChecklistEntity checklist = jpaChecklistRepository.saveAndFlush(new JpaChecklistEntity(null, 1L));
        return saveChecklistItem(checklist.id());
    }

    private static Appointment probe(int startHour, int startMinute, int endHour, int endMinute) {
        return new Appointment(
                999L,
                1L,
                "probe",
                LocalDate.of(2026, 9, 1),
                LocalDateTime.of(2026, 9, 1, startHour, startMinute),
                LocalDateTime.of(2026, 9, 1, endHour, endMinute),
                "probe",
                null,
                false
        );
    }

    private Long saveChecklistItem(Long checklistId) {
        return jpaChecklistItemRepository.saveAndFlush(new JpaChecklistItemEntity(
                null, checklistId, 1L, null, "item", ChecklistItemStatus.PREV)).id();
    }

    private Appointment saveAppointment(Long checklistItemId, Integer startHour, Integer startMinute,
                                        Integer endHour, Integer endMinute, String title) {
        return appointmentRepository.save(new Appointment(
                null,
                checklistItemId,
                title,
                LocalDate.of(2026, 9, 1),
                startHour == null ? null : LocalDateTime.of(2026, 9, 1, startHour, startMinute),
                endHour == null ? null : LocalDateTime.of(2026, 9, 1, endHour, endMinute),
                title,
                null,
                false
        ));
    }

    private Appointment saveAppointment(Long checklistItemId) {
        return appointmentRepository.save(new Appointment(
                null,
                checklistItemId,
                "title",
                LocalDate.of(2026, 9, 1),
                null,
                null,
                null,
                null,
                false
        ));
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
