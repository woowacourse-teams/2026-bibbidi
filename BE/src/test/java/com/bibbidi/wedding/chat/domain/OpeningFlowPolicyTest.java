package com.bibbidi.wedding.chat.domain;

import static com.bibbidi.wedding.chat.ChatTestFixtures.TODAY;
import static com.bibbidi.wedding.chat.ChatTestFixtures.appointment;
import static com.bibbidi.wedding.chat.ChatTestFixtures.emptySnapshot;
import static com.bibbidi.wedding.chat.ChatTestFixtures.item;
import static com.bibbidi.wedding.chat.ChatTestFixtures.snapshot;
import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.domain.PreparationSnapshot.Status;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class OpeningFlowPolicyTest {

    private final OpeningFlowPolicy policy = new OpeningFlowPolicy();

    @Test
    @DisplayName("첫 사용자 요청은 준비 정보 질문보다 우선한다")
    void shouldPrioritizeInitialRequestOverMissingInformation() {
        OpeningDecision decision = policy.classify("드레스 투어 전에 뭘 준비해야 해?", emptySnapshot(), Set.of(), TODAY);

        assertThat(decision.type()).isEqualTo(OpeningType.USER_REQUEST);
        assertThat(decision.askWeddingDate()).isFalse();
    }

    @Test
    @DisplayName("첫 사용자 요청은 지난 일정 확인보다 우선한다")
    void shouldPrioritizeInitialRequestOverPastAppointments() {
        PreparationSnapshot snapshot = snapshot(List.of(
                item(10L, Status.CONTINUE, appointment(100L, TODAY.minusDays(1), false))
        ));

        assertThat(policy.classify("다음 할 일 추천해줘", snapshot, Set.of(), TODAY).type())
                .isEqualTo(OpeningType.USER_REQUEST);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t\n"})
    @DisplayName("첫 요청이 없고 할 일이 없으면 날짜와 진행 상황을 질문한다")
    void shouldAskForInformationWhenNoChecklistItems(String initialMessage) {
        OpeningDecision decision = policy.classify(initialMessage, emptySnapshot(), Set.of(), TODAY);

        assertThat(decision.type()).isEqualTo(OpeningType.PREPARATION_INFORMATION_REQUIRED);
        assertThat(decision.askWeddingDate()).isTrue();
    }

    @Test
    @DisplayName("할 일이 없어도 저장된 예식 날짜는 다시 묻지 않는다")
    void shouldNotAskForStoredWeddingDate() {
        PreparationSnapshot snapshot = new PreparationSnapshot(TODAY.plusMonths(6), List.of(), List.of(),
                emptySnapshot().queriedAt());

        OpeningDecision decision = policy.classify(null, snapshot, Set.of(), TODAY);

        assertThat(decision.type()).isEqualTo(OpeningType.PREPARATION_INFORMATION_REQUIRED);
        assertThat(decision.askWeddingDate()).isFalse();
    }

    @Test
    @DisplayName("지난 미완료 일정 확인은 진행 중인 할 일보다 우선한다")
    void shouldPrioritizePastAppointmentsOverInProgressItems() {
        PreparationSnapshot snapshot = snapshot(List.of(
                item(10L, Status.CONTINUE, appointment(100L, TODAY.minusDays(1), false))
        ));

        OpeningDecision decision = policy.classify(null, snapshot, Set.of(), TODAY);

        assertThat(decision.type()).isEqualTo(OpeningType.PAST_APPOINTMENTS);
        assertThat(decision.appointmentIds()).containsExactly(100L);
        assertThat(decision.checklistItemIds()).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({"2026-10-07, false, true", "2026-10-07, true, false",
            "2026-10-08, false, false", "2026-10-09, false, false"})
    @DisplayName("오늘 이전의 미완료 일정만 확인한다")
    void shouldOnlySelectIncompleteAppointmentsBeforeToday(LocalDate date, boolean done, boolean expectedPast) {
        PreparationSnapshot snapshot = snapshot(List.of(item(10L, Status.PREV, appointment(100L, date, done))));

        OpeningDecision decision = policy.classify(null, snapshot, Set.of(), TODAY);

        assertThat(decision.type()).isEqualTo(expectedPast
                ? OpeningType.PAST_APPOINTMENTS : OpeningType.NEXT_RECOMMENDATIONS);
    }

    @Test
    @DisplayName("현재 대화에서 확인한 일정은 다시 묻지 않고 진행 중인 할 일로 이어간다")
    void shouldSkipConfirmedAppointments() {
        PreparationSnapshot snapshot = snapshot(List.of(
                item(10L, Status.CONTINUE, appointment(100L, TODAY.minusDays(1), false))
        ));

        OpeningDecision decision = policy.classify(null, snapshot, Set.of(100L), TODAY);

        assertThat(decision.type()).isEqualTo(OpeningType.IN_PROGRESS_ITEMS);
        assertThat(decision.checklistItemIds()).containsExactly(10L);
        assertThat(decision.appointmentIds()).isEmpty();
    }

    @Test
    @DisplayName("확인한 일정만 제외하고 나머지 지난 일정은 확인한다")
    void shouldKeepUnconfirmedPastAppointments() {
        PreparationSnapshot snapshot = snapshot(List.of(item(10L, Status.PREV,
                appointment(100L, TODAY.minusDays(2), false), appointment(101L, TODAY.minusDays(1), false))));

        assertThat(policy.classify(null, snapshot, Set.of(100L), TODAY).appointmentIds()).containsExactly(101L);
    }

    @Test
    @DisplayName("진행 중인 할 일이 없으면 다음 할 일을 추천한다")
    void shouldRecommendNextItemsForRemainingStates() {
        PreparationSnapshot snapshot = snapshot(List.of(item(10L, Status.PREV), item(11L, Status.DONE)));

        assertThat(policy.classify(null, snapshot, Set.of(), TODAY).type()).isEqualTo(OpeningType.NEXT_RECOMMENDATIONS);
    }
}
