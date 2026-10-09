package com.bibbidi.wedding.chat.repository;

import static com.bibbidi.wedding.chat.ChatTestFixtures.NOW;
import static com.bibbidi.wedding.chat.ChatTestFixtures.OWNER_ID;
import static com.bibbidi.wedding.chat.ChatTestFixtures.emptySnapshot;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.chat.config.ConversationStateProperties;
import com.bibbidi.wedding.chat.domain.ConversationState;
import com.bibbidi.wedding.chat.domain.ExplicitUserFact;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ConversationStateRepositoryTest {

    private static final Long OTHER_USER_ID = 2L;
    private final Clock clock = mock(Clock.class);
    private final ConversationStateProperties properties = new ConversationStateProperties(Duration.ofMinutes(30));
    private ConversationStateRepository repository;

    @BeforeEach
    void setUp() {
        when(clock.instant()).thenReturn(NOW);
        repository = new ConversationStateRepository(clock, properties);
    }

    @Test
    @DisplayName("소유자와 빈 대화 조건을 연결해 서로 다른 대화를 생성한다")
    void shouldCreateDistinctConversations() {
        ConversationState first = repository.create(OWNER_ID, emptySnapshot());
        ConversationState second = repository.create(OWNER_ID, emptySnapshot());

        assertThat(first.id()).isNotEqualTo(second.id());
        assertThat(first.ownerId()).isEqualTo(OWNER_ID);
        assertThat(first.explicitFacts()).isEmpty();
        assertThat(first.confirmedAppointmentIds()).isEmpty();
        assertThat(repository.findOwnedBy(first.id(), OWNER_ID)).contains(first);
    }

    @Test
    @DisplayName("다른 사용자는 대화를 조회하거나 변경하거나 종료할 수 없다")
    void shouldRejectOtherUsersAccess() {
        ConversationState state = repository.create(OWNER_ID, emptySnapshot());
        ConversationState changed = state.withAcceptedContext(List.of(new ExplicitUserFact("조건", "근거")), Set.of());

        assertThat(repository.findOwnedBy(state.id(), OTHER_USER_ID)).isEmpty();
        assertThat(repository.saveOwnedBy(OTHER_USER_ID, changed)).isEmpty();
        assertThat(repository.deleteOwnedBy(state.id(), OTHER_USER_ID)).isFalse();
        assertThat(repository.findOwnedBy(state.id(), OWNER_ID)).contains(state);
    }

    @Test
    @DisplayName("대화 소유자를 바꾼 객체를 만들어도 다른 사용자 대화를 덮어쓸 수 없다")
    void shouldRejectForgedOwnership() {
        ConversationState state = repository.create(OWNER_ID, emptySnapshot());
        ConversationState forged = new ConversationState(state.id(), OTHER_USER_ID, state.snapshot(), List.of(), Set.of());

        assertThat(repository.saveOwnedBy(OTHER_USER_ID, forged)).isEmpty();
        assertThat(repository.saveOwnedBy(OWNER_ID, forged)).isEmpty();
        assertThat(repository.findOwnedBy(state.id(), OWNER_ID)).contains(state);
    }

    @Test
    @DisplayName("30분 미사용 경계에서 대화는 만료된다")
    void shouldExpireAtIdleTimeoutBoundary() {
        ConversationState state = repository.create(OWNER_ID, emptySnapshot());
        advanceMinutes(30);

        assertThat(repository.findOwnedBy(state.id(), OWNER_ID)).isEmpty();
        assertThat(repository.saveOwnedBy(OWNER_ID, state)).isEmpty();
    }

    @Test
    @DisplayName("정상 조회는 수명을 연장하지만 스냅샷의 DB 조회 시각은 바꾸지 않는다")
    void shouldExtendLifetimeOnOwnedReadWithoutChangingQueryTime() {
        ConversationState state = repository.create(OWNER_ID, emptySnapshot());
        advanceMinutes(29);
        assertThat(repository.findOwnedBy(state.id(), OWNER_ID)).contains(state);
        advanceMinutes(58);
        assertThat(repository.findOwnedBy(state.id(), OWNER_ID)).contains(state);
        assertThat(state.snapshot().queriedAt()).isEqualTo(NOW);
        advanceMinutes(88);
        assertThat(repository.findOwnedBy(state.id(), OWNER_ID)).isEmpty();
    }

    @Test
    @DisplayName("다른 사용자의 조회와 변경 시도는 대화 수명을 연장하지 않는다")
    void shouldNotExtendLifetimeOnUnauthorizedAccess() {
        ConversationState state = repository.create(OWNER_ID, emptySnapshot());
        advanceMinutes(29);
        repository.findOwnedBy(state.id(), OTHER_USER_ID);
        ConversationState forged = new ConversationState(state.id(), OTHER_USER_ID, state.snapshot(), List.of(), Set.of());
        repository.saveOwnedBy(OTHER_USER_ID, forged);
        advanceMinutes(30);

        assertThat(repository.findOwnedBy(state.id(), OWNER_ID)).isEmpty();
    }

    @Test
    @DisplayName("소유자의 정상 변경은 상태를 반영하고 대화 수명을 연장한다")
    void shouldSaveContextAndExtendLifetime() {
        ConversationState state = repository.create(OWNER_ID, emptySnapshot());
        ConversationState changed = state.withAcceptedContext(List.of(new ExplicitUserFact("촬영 제외", "촬영 안 해")),
                Set.of(100L));
        advanceMinutes(29);

        assertThat(repository.saveOwnedBy(OWNER_ID, changed)).contains(changed);
        advanceMinutes(58);
        assertThat(repository.findOwnedBy(state.id(), OWNER_ID)).contains(changed);
    }

    @Test
    @DisplayName("만료한 대화의 변경은 대화를 되살리지 않는다")
    void shouldNotSaveExpiredConversation() {
        ConversationState state = repository.create(OWNER_ID, emptySnapshot());
        advanceMinutes(30);

        assertThat(repository.saveOwnedBy(OWNER_ID, state)).isEmpty();
        assertThat(repository.findOwnedBy(state.id(), OWNER_ID)).isEmpty();
    }

    @Test
    @DisplayName("소유자는 대화를 종료할 수 있다")
    void shouldDeleteOwnedConversation() {
        ConversationState state = repository.create(OWNER_ID, emptySnapshot());

        assertThat(repository.deleteOwnedBy(state.id(), OWNER_ID)).isTrue();
        assertThat(repository.findOwnedBy(state.id(), OWNER_ID)).isEmpty();
        assertThat(repository.saveOwnedBy(OWNER_ID, state)).isEmpty();
    }

    @Test
    @DisplayName("정리 작업은 만료 상태만 제거하고 정상 사용한 대화는 유지한다")
    void shouldCleanUpExpiredConversationsOnly() {
        ConversationState expired = repository.create(OWNER_ID, emptySnapshot());
        ConversationState active = repository.create(OWNER_ID, emptySnapshot());
        advanceMinutes(29);
        repository.findOwnedBy(active.id(), OWNER_ID);
        advanceMinutes(30);

        assertThat(repository.cleanupExpired()).isEqualTo(1);
        assertThat(repository.cleanupExpired()).isZero();
        assertThat(repository.findOwnedBy(expired.id(), OWNER_ID)).isEmpty();
        assertThat(repository.findOwnedBy(active.id(), OWNER_ID)).contains(active);
    }

    @Test
    @DisplayName("서버 재시작에 해당하는 새 저장소에는 이전 대화가 없다")
    void shouldNotRestoreConversationsInNewRepository() {
        ConversationState state = repository.create(OWNER_ID, emptySnapshot());
        ConversationStateRepository restarted = new ConversationStateRepository(clock, properties);

        assertThat(restarted.findOwnedBy(state.id(), OWNER_ID)).isEmpty();
        assertThat(restarted.findOwnedBy("missing", OWNER_ID)).isEmpty();
        assertThat(restarted.saveOwnedBy(OWNER_ID, state)).isEmpty();
    }

    private void advanceMinutes(long minutes) {
        when(clock.instant()).thenReturn(NOW.plus(Duration.ofMinutes(minutes)));
    }
}
