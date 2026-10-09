package com.bibbidi.wedding.chat.service;

import static com.bibbidi.wedding.chat.ChatTestFixtures.CLOCK;
import static com.bibbidi.wedding.chat.ChatTestFixtures.OWNER_ID;
import static com.bibbidi.wedding.chat.ChatTestFixtures.TODAY;
import static com.bibbidi.wedding.chat.ChatTestFixtures.appointment;
import static com.bibbidi.wedding.chat.ChatTestFixtures.emptySnapshot;
import static com.bibbidi.wedding.chat.ChatTestFixtures.item;
import static com.bibbidi.wedding.chat.ChatTestFixtures.snapshot;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.chat.domain.ConversationState;
import com.bibbidi.wedding.chat.domain.OpeningFlowPolicy;
import com.bibbidi.wedding.chat.domain.OpeningType;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot.Status;
import com.bibbidi.wedding.chat.repository.ConversationStateRepository;
import com.bibbidi.wedding.chat.service.dto.ConversationStartResult;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ConversationServiceTest {

    private final PreparationContextService contextService = mock(PreparationContextService.class);
    private final ConversationStateRepository repository = mock(ConversationStateRepository.class);
    private final ConversationService service = new ConversationService(contextService, repository,
            new OpeningFlowPolicy(), CLOCK);

    @Test
    @DisplayName("대화 시작은 준비 조회 결과를 소유자와 연결하고 한국 날짜로 시작 상황을 분류한다")
    void shouldStartConversationUsingKoreanDateAndLoadedSnapshot() {
        PreparationSnapshot snapshot = snapshot(List.of(
                item(10L, Status.PREV, appointment(100L, TODAY.minusDays(1), false))
        ));
        ConversationState state = new ConversationState("conversation", OWNER_ID, snapshot, List.of(), Set.of());
        when(contextService.load(OWNER_ID)).thenReturn(snapshot);
        when(repository.create(OWNER_ID, snapshot)).thenReturn(state);

        ConversationStartResult started = service.start(OWNER_ID, null);

        assertThat(started.state()).isSameAs(state);
        assertThat(started.opening().type()).isEqualTo(OpeningType.PAST_APPOINTMENTS);
        assertThat(started.opening().appointmentIds()).containsExactly(100L);
        verify(repository).create(OWNER_ID, snapshot);
    }

    @Test
    @DisplayName("초기 메시지는 시작 정책에 전달하지만 사용자 조건으로 임의 반영하지 않는다")
    void shouldPassInitialMessageWithoutInferringFacts() {
        PreparationSnapshot snapshot = emptySnapshot();
        ConversationState state = new ConversationState("conversation", OWNER_ID, snapshot, List.of(), Set.of());
        when(contextService.load(OWNER_ID)).thenReturn(snapshot);
        when(repository.create(OWNER_ID, snapshot)).thenReturn(state);

        ConversationStartResult started = service.start(OWNER_ID, "촬영은 안 할게");

        assertThat(started.opening().type()).isEqualTo(OpeningType.USER_REQUEST);
        assertThat(started.state().explicitFacts()).isEmpty();
    }

    @Test
    @DisplayName("준비 상태 조회가 실패하면 빈 상태로 대화를 생성하지 않는다")
    void shouldNotCreateConversationWhenPreparationLookupFails() {
        var failure = new IllegalStateException("준비 조회 실패");
        when(contextService.load(OWNER_ID)).thenThrow(failure);

        assertThatThrownBy(() -> service.start(OWNER_ID, null)).isSameAs(failure);
        verifyNoInteractions(repository);
    }

    @Test
    @DisplayName("보관한 대화 조회는 소유자 정보를 전달하고 DB를 다시 조회하지 않는다")
    void shouldFindOwnedConversationWithoutReloadingDatabase() {
        ConversationState state = new ConversationState("conversation", OWNER_ID, emptySnapshot(), List.of(), Set.of());
        when(repository.findOwnedBy(state.id(), OWNER_ID)).thenReturn(Optional.of(state));

        assertThat(service.findOwnedBy(state.id(), OWNER_ID)).contains(state);
        verifyNoInteractions(contextService);
    }

    @Test
    @DisplayName("대화가 없거나 접근할 수 없으면 보관 상태 없음으로 반환한다")
    void shouldReturnEmptyForUnavailableConversation() {
        when(repository.findOwnedBy("missing", OWNER_ID)).thenReturn(Optional.empty());

        assertThat(service.findOwnedBy("missing", OWNER_ID)).isEmpty();
        verifyNoInteractions(contextService);
    }
}
