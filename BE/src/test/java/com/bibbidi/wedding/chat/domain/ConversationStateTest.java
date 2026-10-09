package com.bibbidi.wedding.chat.domain;

import static com.bibbidi.wedding.chat.ChatTestFixtures.NOW;
import static com.bibbidi.wedding.chat.ChatTestFixtures.OWNER_ID;
import static com.bibbidi.wedding.chat.ChatTestFixtures.TODAY;
import static com.bibbidi.wedding.chat.ChatTestFixtures.appointment;
import static com.bibbidi.wedding.chat.ChatTestFixtures.item;
import static com.bibbidi.wedding.chat.ChatTestFixtures.snapshot;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.chat.domain.PreparationSnapshot.CatalogItem;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot.ChecklistItem;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot.Status;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ConversationStateTest {

    @Test
    @DisplayName("통과한 사용자 조건과 확인 일정은 DB 스냅샷의 상태를 바꾸지 않는다")
    void shouldKeepDatabaseSnapshotWhenApplyingAcceptedContext() {
        PreparationSnapshot snapshot = snapshot(List.of(
                item(10L, Status.CONTINUE, appointment(100L, TODAY.minusDays(1), false))
        ));
        ConversationState original = new ConversationState("conversation", OWNER_ID, snapshot, List.of(), Set.of());

        ConversationState changed = original.withAcceptedContext(
                List.of(new ExplicitUserFact("피팅 방문 완료", "피팅 다녀왔어")), Set.of(100L));

        assertThat(changed.snapshot()).isSameAs(snapshot);
        assertThat(changed.snapshot().checklistItems().getFirst().status()).isEqualTo(Status.CONTINUE);
        assertThat(changed.snapshot().checklistItems().getFirst().appointments().getFirst().done()).isFalse();
        assertThat(changed.explicitFacts()).hasSize(1);
        assertThat(changed.confirmedAppointmentIds()).containsExactly(100L);
        assertThat(original.explicitFacts()).isEmpty();
        assertThat(original.confirmedAppointmentIds()).isEmpty();
    }

    @Test
    @DisplayName("입력 컬렉션을 바꿔도 보관된 스냅샷과 대화 조건은 바뀌지 않는다")
    void shouldDefensivelyCopySnapshotAndContextCollections() {
        var appointments = new ArrayList<>(List.of(appointment(100L, TODAY, false)));
        var item = new ChecklistItem(10L, null, null, "피팅", Status.PREV, appointments);
        var items = new ArrayList<>(List.of(item));
        var catalog = new ArrayList<>(List.of(new CatalogItem(1L, "드레스 투어", "스드메", 1, "계약")));
        var facts = new ArrayList<>(List.of(new ExplicitUserFact("촬영 제외", "촬영은 안 할게")));
        var confirmed = new HashSet<>(Set.of(100L));
        PreparationSnapshot snapshot = new PreparationSnapshot(null, items, catalog, NOW);
        ConversationState state = new ConversationState("conversation", OWNER_ID, snapshot, facts, confirmed);

        appointments.clear();
        items.clear();
        catalog.clear();
        facts.clear();
        confirmed.clear();

        assertThat(state.snapshot().checklistItems()).hasSize(1);
        assertThat(state.snapshot().checklistItems().getFirst().appointments()).hasSize(1);
        assertThat(state.snapshot().catalogItems()).hasSize(1);
        assertThat(state.explicitFacts()).hasSize(1);
        assertThat(state.confirmedAppointmentIds()).containsExactly(100L);
        assertThatThrownBy(() -> state.snapshot().checklistItems().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> state.explicitFacts().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> state.confirmedAppointmentIds().clear()).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @DisplayName("등록된 카탈로그 항목은 상태에 관계없이 새 추천 후보에서 제외한다")
    void shouldExcludeRegisteredItemsIncludingCompletedOnes() {
        PreparationSnapshot snapshot = new PreparationSnapshot(null, List.of(
                new ChecklistItem(10L, 1L, 100L, "드레스 투어", Status.DONE, List.of()),
                item(11L, Status.PREV)
        ), List.of(
                new CatalogItem(100L, "드레스 투어", "스드메", 1, "계약"),
                new CatalogItem(101L, "드레스 피팅", "스드메", 2, "피팅")
        ), NOW);

        assertThat(snapshot.recommendationCandidates()).extracting(CatalogItem::id).containsExactly(101L);
        assertThat(snapshot.catalogItems()).hasSize(2);
    }
}
