package com.bibbidi.wedding.chat.adapter.ai.memory;

import static org.assertj.core.api.Assertions.assertThat;

import com.github.benmanes.caffeine.cache.Scheduler;
import com.github.benmanes.caffeine.cache.Ticker;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;

class ExpiringChatMemoryRepositoryTest {

    private static final Duration IDLE_TIMEOUT = Duration.ofHours(1);

    private final AtomicLong nanos = new AtomicLong();
    private ExpiringChatMemoryRepository repository;

    @BeforeEach
    void setUp() {
        Ticker ticker = nanos::get;
        repository = new ExpiringChatMemoryRepository(IDLE_TIMEOUT, ticker, Scheduler.disabledScheduler());
    }

    @Test
    @DisplayName("저장한 대화의 메시지를 그대로 돌려주고, 없는 대화는 빈 목록을 돌려준다")
    void findsSavedMessagesAndReturnsNothingForUnknownConversations() {
        List<Message> messages = List.of(new UserMessage("질문"), new AssistantMessage("답변"));

        repository.saveAll("one", messages);

        assertThat(repository.findByConversationId("one")).isEqualTo(messages);
        assertThat(repository.findByConversationId("unknown")).isEmpty();
        assertThat(repository.findConversationIds()).containsExactly("one");
    }

    @Test
    @DisplayName("마지막으로 쓴 뒤 유휴 시간이 지나면 대화를 지운다")
    void removesAConversationAfterTheIdleTimeout() {
        repository.saveAll("one", List.of(new UserMessage("질문")));

        passTime(IDLE_TIMEOUT.plusSeconds(1));

        assertThat(repository.findByConversationId("one")).isEmpty();
        assertThat(repository.findConversationIds()).isEmpty();
    }

    @Test
    @DisplayName("대화를 읽거나 쓸 때마다 유휴 시간을 다시 센다")
    void restartsTheIdleTimeWhenAConversationIsUsed() {
        repository.saveAll("one", List.of(new UserMessage("질문")));
        repository.saveAll("two", List.of(new UserMessage("질문")));

        passTime(Duration.ofMinutes(40));
        repository.findByConversationId("one");
        passTime(Duration.ofMinutes(40));

        assertThat(repository.findByConversationId("one")).hasSize(1);
        assertThat(repository.findByConversationId("two")).isEmpty();
    }

    @Test
    @DisplayName("지운 대화는 더 이상 찾지 않는다")
    void deletesAConversation() {
        repository.saveAll("one", List.of(new UserMessage("질문")));

        repository.deleteByConversationId("one");

        assertThat(repository.findByConversationId("one")).isEmpty();
    }

    private void passTime(Duration duration) {
        nanos.addAndGet(duration.toNanos());
    }
}
