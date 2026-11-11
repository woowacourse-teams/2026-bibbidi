package com.bibbidi.wedding.checklist.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.checklist.domain.Appointment;
import com.bibbidi.wedding.checklist.persistence.JpaAppointmentEntity;
import com.bibbidi.wedding.checklist.persistence.JpaAppointmentRepository;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import com.bibbidi.wedding.support.TestDatabaseLocks;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
@Import({AppointmentRepository.class, AppointmentMapper.class})
@ResourceLock(TestDatabaseLocks.SPRING_TEST)
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
                false,
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
    @DisplayName("할 일에 완료하지 않은 일정이 하나라도 있으면 남은 일정이 있다고 판단한다")
    void shouldFindRemainingAppointmentWhenAnyAppointmentIsNotDone() {
        saveDoneAppointment(10L, "이미 끝낸 일정");
        saveAppointment(10L, "아직 안 끝낸 일정");

        boolean hasRemaining = appointmentRepository.existsRemainingByChecklistItemId(10L);

        assertThat(hasRemaining).isTrue();
    }

    @Test
    @DisplayName("할 일의 일정이 모두 완료되었으면 남은 일정이 없다고 판단한다")
    void shouldNotFindRemainingAppointmentWhenEveryAppointmentIsDone() {
        saveDoneAppointment(10L, "첫 번째로 끝낸 일정");
        saveDoneAppointment(10L, "두 번째로 끝낸 일정");

        boolean hasRemaining = appointmentRepository.existsRemainingByChecklistItemId(10L);

        assertThat(hasRemaining).isFalse();
    }

    @Test
    @DisplayName("할 일에 일정이 하나도 없으면 남은 일정이 없다고 판단한다")
    void shouldNotFindRemainingAppointmentWhenChecklistItemHasNoAppointment() {
        boolean hasRemaining = appointmentRepository.existsRemainingByChecklistItemId(10L);

        assertThat(hasRemaining).isFalse();
    }

    @Test
    @DisplayName("다른 할 일에 달린 미완료 일정은 남은 일정으로 세지 않는다")
    void shouldNotCountRemainingAppointmentOfOtherChecklistItem() {
        saveAppointment(20L, "다른 할 일의 일정");

        boolean hasRemaining = appointmentRepository.existsRemainingByChecklistItemId(10L);

        assertThat(hasRemaining).isFalse();
    }

    @Test
    @DisplayName("지정한 할 일들의 일정을 완료 여부와 관계없이 모두 조회한다")
    void shouldFindAllAppointmentsOfGivenChecklistItems() {
        Appointment remaining = saveAppointment(10L, "아직 안 끝낸 일정");
        Appointment done = saveDoneAppointment(11L, "이미 끝낸 일정");
        saveAppointment(20L, "지정하지 않은 할 일의 일정");

        List<Appointment> found = appointmentRepository.findAllByChecklistItemIdIn(List.of(10L, 11L, 12L));

        assertThat(found)
                .extracting(Appointment::id)
                .containsExactlyInAnyOrder(remaining.id(), done.id());
    }

    @Test
    @DisplayName("지정한 할 일 ID가 없으면 빈 일정 목록을 조회한다")
    void shouldFindNoAppointmentWhenChecklistItemIdsAreEmpty() {
        saveAppointment(10L, "지정하지 않은 할 일의 일정");

        List<Appointment> found = appointmentRepository.findAllByChecklistItemIdIn(List.of());

        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("할 일에 남은 미완료 일정만 조회한다")
    void shouldFindOnlyRemainingAppointmentsOfChecklistItem() {
        Appointment remaining = saveAppointment(10L, "아직 안 끝낸 일정");
        saveDoneAppointment(10L, "이미 끝낸 일정");
        saveAppointment(20L, "다른 할 일의 일정");

        List<Appointment> found = appointmentRepository.findAllRemainingByChecklistItemId(10L);

        assertThat(found)
                .extracting(Appointment::id)
                .containsExactly(remaining.id());
    }

    @Test
    @DisplayName("할 일의 완료된 일정만 조회한다")
    void shouldFindOnlyDoneAppointmentsOfChecklistItem() {
        saveAppointment(10L, "아직 안 끝낸 일정");
        Appointment done = saveDoneAppointment(10L, "이미 끝낸 일정");
        saveDoneAppointment(20L, "다른 할 일의 끝낸 일정");

        List<Appointment> found = appointmentRepository.findAllCompletedByChecklistItemId(10L);

        assertThat(found)
                .extracting(Appointment::id)
                .containsExactly(done.id());
    }

    @Test
    @DisplayName("할 일에 남은 일정이 없으면 빈 목록을 조회한다")
    void shouldFindNoRemainingAppointmentWhenEveryAppointmentIsDone() {
        saveDoneAppointment(10L, "이미 끝낸 일정");

        List<Appointment> found = appointmentRepository.findAllRemainingByChecklistItemId(10L);

        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("여러 일정의 완료 상태를 한 번에 저장한다")
    void shouldSaveCompletedAppointmentsAtOnce() {
        Appointment first = saveAppointment(10L, "첫 번째 일정");
        Appointment second = saveAppointment(10L, "두 번째 일정");

        appointmentRepository.saveAll(List.of(
                first.completeByChecklistItem(),
                second.completeByChecklistItem()
        ));

        assertThat(jpaAppointmentRepository.findAllById(List.of(first.id(), second.id())))
                .allSatisfy(appointment -> {
                    assertThat(appointment.isDone()).isTrue();
                    assertThat(appointment.doneByChecklistItem()).isTrue();
                });
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
                false,
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
    @DisplayName("할 일에 연결된 일정을 한 번에 삭제한다")
    void shouldDeleteAllAppointmentsByChecklistItemId() {
        Appointment first = saveAppointment(1L);
        Appointment second = saveAppointment(1L);
        Appointment remaining = saveAppointment(2L);

        appointmentRepository.deleteAllByChecklistItemIds(List.of(1L));

        assertThat(jpaAppointmentRepository.findById(first.id())).isEmpty();
        assertThat(jpaAppointmentRepository.findById(second.id())).isEmpty();
        assertThat(jpaAppointmentRepository.findById(remaining.id())).isPresent();
    }

    @Test
    @DisplayName("시간이 겹칠 수 있는 본인 소유 일정만 후보로 조회한다")
    void shouldFindOverlapCandidatesOwnedByUser() {
        JpaChecklistEntity ownChecklist = jpaChecklistRepository.saveAndFlush(new JpaChecklistEntity(null, 1L));
        JpaChecklistEntity otherUsersChecklist = jpaChecklistRepository.saveAndFlush(new JpaChecklistEntity(null, 2L));
        Long firstItemId = saveChecklistItem(ownChecklist);
        Long secondItemId = saveChecklistItem(ownChecklist);
        Long otherUsersItemId = saveChecklistItem(otherUsersChecklist);

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
        return saveChecklistItem(checklist);
    }

    @Test
    @DisplayName("완료되지 않은 오늘 이후 일정만 가까운 일정으로 조회한다")
    void shouldFindOnlyRemainingUpcomingAppointmentsAsNearby() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 1, 10, 0);
        Long itemId = saveOwnedChecklistItem();
        LocalDate tomorrowDate = now.toLocalDate().plusDays(1);
        Appointment tomorrow = saveAppointmentOnDate(itemId, tomorrowDate, tomorrowDate.atTime(9, 0), "내일 일정");
        saveAppointmentOnDate(itemId, now.toLocalDate().minusDays(1), null, "지난 일정");
        saveDoneAppointmentOnDate(itemId, tomorrowDate, "완료된 미래 일정");

        List<Appointment> found = appointmentRepository.findNearby(1L, now, 6);

        assertThat(found)
                .extracting(Appointment::id)
                .containsExactly(tomorrow.id());
    }

    @Test
    @DisplayName("오늘은 요청 시각 이상이거나 시각 없는 일정만 가까운 일정에 포함한다")
    void shouldIncludeTodaysAppointmentOnlyWhenNotYetStartedOrTimeless() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 1, 10, 0);
        Long itemId = saveOwnedChecklistItem();
        Appointment timelessToday = saveAppointmentOnDate(itemId, now.toLocalDate(), null, "시각 없는 오늘 일정");
        Appointment upcomingToday = saveAppointmentOnDate(itemId, now.toLocalDate(), now.plusHours(1), "이따 일정");
        Appointment startingNow = saveAppointmentOnDate(itemId, now.toLocalDate(), now, "요청 시각 일정");
        saveAppointmentOnDate(itemId, now.toLocalDate(), now.minusSeconds(1), "지난 오늘 일정");

        List<Appointment> found = appointmentRepository.findNearby(1L, now, 6);

        assertThat(found)
                .extracting(Appointment::id)
                .containsExactly(startingNow.id(), upcomingToday.id(), timelessToday.id());
    }

    @Test
    @DisplayName("다른 사용자 소유 일정은 가까운 일정에 포함하지 않는다")
    void shouldExcludeOtherUsersAppointmentFromNearby() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 1, 10, 0);
        JpaChecklistEntity otherUsersChecklist = jpaChecklistRepository.saveAndFlush(new JpaChecklistEntity(null, 2L));
        Long otherUsersItemId = saveChecklistItem(otherUsersChecklist);
        saveAppointmentOnDate(otherUsersItemId, now.toLocalDate().plusDays(1), null, "다른 사용자 일정");

        List<Appointment> found = appointmentRepository.findNearby(1L, now, 6);

        assertThat(found).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 3, 6})
    @DisplayName("가까운 일정은 날짜, 시각 유무, 시작 시각, ID 순서로 정렬해 요청한 개수만 조회한다")
    void shouldOrderAndLimitNearbyAppointments(int limit) {
        LocalDateTime now = LocalDateTime.of(2026, 9, 1, 10, 0);
        LocalDate tomorrow = now.toLocalDate().plusDays(1);
        LocalDate dayAfterTomorrow = tomorrow.plusDays(1);
        Long itemId = saveOwnedChecklistItem();
        Appointment last = saveAppointmentOnDate(itemId, dayAfterTomorrow, dayAfterTomorrow.atTime(9, 0), "모레 일정");
        Appointment timeless = saveAppointmentOnDate(itemId, tomorrow, null, "시각 없는 내일 일정");
        Appointment later = saveAppointmentOnDate(itemId, tomorrow, tomorrow.atTime(11, 0), "내일 늦은 일정");
        Appointment earlier = saveAppointmentOnDate(itemId, tomorrow, tomorrow.atTime(9, 0), "내일 이른 일정");
        Appointment sameTime = saveAppointmentOnDate(itemId, tomorrow, tomorrow.atTime(9, 0), "내일 같은 시각 일정");

        List<Appointment> found = appointmentRepository.findNearby(1L, now, limit);

        List<Long> orderedIds = List.of(earlier.id(), sameTime.id(), later.id(), timeless.id(), last.id());
        assertThat(found)
                .extracting(Appointment::id)
                .containsExactlyElementsOf(orderedIds.subList(0, Math.min(limit, orderedIds.size())));
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    @DisplayName("날짜와 시작 시각이 같으면 ID 오름차순으로 제한 경계를 결정한다")
    void shouldLimitNearbyAppointmentsByIdWhenDateAndTimeAreEqual(boolean timed) {
        LocalDateTime now = LocalDateTime.of(2026, 9, 1, 10, 0);
        Long itemId = saveOwnedChecklistItem();
        LocalDateTime startTime = timed ? now.plusHours(1) : null;
        Appointment first = saveAppointmentOnDate(itemId, now.toLocalDate(), startTime, "첫 번째 일정");
        Appointment second = saveAppointmentOnDate(itemId, now.toLocalDate(), startTime, "두 번째 일정");
        saveAppointmentOnDate(itemId, now.toLocalDate(), startTime, "제한 밖 일정");

        List<Appointment> found = appointmentRepository.findNearby(1L, now, 2);

        assertThat(found)
                .extracting(Appointment::id)
                .containsExactly(first.id(), second.id());
    }

    @Test
    @DisplayName("시각 없는 오늘 일정이 시각 있는 내일 일정보다 먼저 가까운 일정으로 반환된다")
    void shouldPrioritizeTodaysTimelessAppointmentOverTomorrowsTimedNearbyAppointment() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 1, 10, 0);
        Long itemId = saveOwnedChecklistItem();
        LocalDate tomorrow = now.toLocalDate().plusDays(1);
        saveAppointmentOnDate(itemId, tomorrow, tomorrow.atTime(9, 0), "시각 있는 내일 일정");
        Appointment today = saveAppointmentOnDate(itemId, now.toLocalDate(), null, "시각 없는 오늘 일정");

        List<Appointment> found = appointmentRepository.findNearby(1L, now, 1);

        assertThat(found).extracting(Appointment::id).containsExactly(today.id());
    }

    @Test
    @DisplayName("가까운 일정이 없으면 빈 목록을 조회한다")
    void shouldFindNoNearbyAppointmentsWhenNoneExist() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 1, 10, 0);

        List<Appointment> found = appointmentRepository.findNearby(1L, now, 6);

        assertThat(found).isEmpty();
    }

    private Appointment saveAppointmentOnDate(Long checklistItemId, LocalDate date, LocalDateTime startTime, String title) {
        return appointmentRepository.save(new Appointment(
                null,
                checklistItemId,
                title,
                date,
                startTime,
                startTime,
                startTime == null ? null : "place",
                null,
                false,
                false
        ));
    }

    private Appointment saveDoneAppointmentOnDate(Long checklistItemId, LocalDate date, String title) {
        return appointmentRepository.save(new Appointment(
                null,
                checklistItemId,
                title,
                date,
                null,
                null,
                null,
                null,
                true,
                false
        ));
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
                false,
                false
        );
    }

    private Long saveChecklistItem(JpaChecklistEntity checklist) {
        return jpaChecklistItemRepository.saveAndFlush(new JpaChecklistItemEntity(
                null, checklist, 1L, null, "item", ChecklistItemStatus.PREV)).id();
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
                false,
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
                false,
                false
        ));
    }

    private Appointment saveDoneAppointment(Long checklistItemId, String title) {
        return appointmentRepository.save(new Appointment(
                null,
                checklistItemId,
                title,
                LocalDate.of(2026, 9, 1),
                null,
                null,
                null,
                null,
                true,
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
                false,
                false
        ));
    }
}
