package com.bibbidi.wedding.chat.adapter.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.service.dto.prompt.BibbidiCustomChatPromptContext;
import com.bibbidi.wedding.chat.service.dto.prompt.ChecklistSnapshot;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;

class BibbidiInMemoryChatMemoryTest {

    private static final String CONVERSATION = "7:conversation-a";
    private static final String ANOTHER_CONVERSATION = "7:conversation-b";
    private static final int MAX_MESSAGES = 4;

    private ChatMemoryRepository repository;
    private BibbidiInMemoryChatMemory memory;

    @BeforeEach
    void setUp() {
        repository = new InMemoryChatMemoryRepository();
        memory = new BibbidiInMemoryChatMemory(repository, MAX_MESSAGES);
    }

    @Test
    @DisplayName("추가한 문답을 순서대로 조회한다")
    void returnsAddedMessagesInOrder() {
        // given
        memory.add(CONVERSATION, turn("예산은 1000", "알겠습니다."));

        // when
        List<Message> messages = memory.get(CONVERSATION);

        // then
        assertThat(messages).extracting(Message::getText).containsExactly("예산은 1000", "알겠습니다.");
    }

    @Test
    @DisplayName("최대 메시지 수를 넘으면 오래된 문답부터 버린다")
    void dropsTheOldestMessagesBeyondTheLimit() {
        // given
        memory.add(CONVERSATION, turn("질문 1", "답변 1"));
        memory.add(CONVERSATION, turn("질문 2", "답변 2"));

        // when
        memory.add(CONVERSATION, turn("질문 3", "답변 3"));

        // then
        assertThat(memory.get(CONVERSATION)).extracting(Message::getText)
                .containsExactly("질문 2", "답변 2", "질문 3", "답변 3");
    }

    @Test
    @DisplayName("대화마다 기록을 따로 보관한다")
    void keepsConversationsSeparate() {
        // given
        memory.add(CONVERSATION, turn("첫 대화 질문", "첫 대화 답변"));

        // when
        memory.add(ANOTHER_CONVERSATION, turn("다른 대화 질문", "다른 대화 답변"));

        // then
        assertThat(memory.get(CONVERSATION)).extracting(Message::getText)
                .containsExactly("첫 대화 질문", "첫 대화 답변");
        assertThat(memory.get(ANOTHER_CONVERSATION)).extracting(Message::getText)
                .containsExactly("다른 대화 질문", "다른 대화 답변");
    }

    @Test
    @DisplayName("대화에 연결한 준비 정보를 조회하고, 다시 기억하면 최신 정보로 바꾼다")
    void remembersTheLatestPromptContextPerConversation() {
        // given
        BibbidiCustomChatPromptContext first = context("웨딩홀 후보 정하기");
        BibbidiCustomChatPromptContext latest = context("스튜디오 후보 정하기");
        memory.remember(CONVERSATION, first);

        // when
        memory.remember(CONVERSATION, latest);

        // then
        assertThat(memory.bibbidiCustomContext(CONVERSATION)).isEqualTo(latest);
        assertThat(memory.bibbidiCustomContext(ANOTHER_CONVERSATION)).isNull();
    }

    @Test
    @DisplayName("준비 정보는 대화 기록 저장소에 저장하지 않는다")
    void doesNotStorePromptContextInTheMessageRepository() {
        // when
        memory.remember(CONVERSATION, context("웨딩홀 후보 정하기"));

        // then
        assertThat(repository.findConversationIds()).isEmpty();
        assertThat(memory.get(CONVERSATION)).isEmpty();
    }

    @Test
    @DisplayName("대화를 지우면 대화 기록과 준비 정보를 함께 지운다")
    void clearRemovesMessagesAndPromptContext() {
        // given
        memory.add(CONVERSATION, turn("질문", "답변"));
        memory.remember(CONVERSATION, context("웨딩홀 후보 정하기"));

        // when
        memory.clear(CONVERSATION);

        // then
        assertThat(memory.get(CONVERSATION)).isEmpty();
        assertThat(memory.bibbidiCustomContext(CONVERSATION)).isNull();
    }

    @Test
    @DisplayName("오래 쓰지 않은 대화만 기록과 준비 정보를 함께 지운다")
    void evictsOnlyIdleConversations() {
        // given
        MutableClock clock = new MutableClock();
        BibbidiInMemoryChatMemory clocked = new BibbidiInMemoryChatMemory(repository, MAX_MESSAGES, clock);
        clocked.add(CONVERSATION, turn("오래된 질문", "오래된 답변"));
        clocked.remember(CONVERSATION, context("웨딩홀 후보 정하기"));
        clock.advance(Duration.ofMinutes(90));
        clocked.add(ANOTHER_CONVERSATION, turn("최근 질문", "최근 답변"));

        // when
        int evicted = clocked.evictIdle(Duration.ofHours(1));

        // then
        assertThat(evicted).isEqualTo(1);
        assertThat(clocked.get(CONVERSATION)).isEmpty();
        assertThat(clocked.bibbidiCustomContext(CONVERSATION)).isNull();
        assertThat(clocked.get(ANOTHER_CONVERSATION)).hasSize(2);
        assertThat(clocked.conversationCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("대화를 다시 쓰면 마지막 사용 시각이 갱신되어 정리하지 않는다")
    void keepsConversationsUsedAgain() {
        // given
        MutableClock clock = new MutableClock();
        BibbidiInMemoryChatMemory clocked = new BibbidiInMemoryChatMemory(repository, MAX_MESSAGES, clock);
        clocked.add(CONVERSATION, turn("질문 1", "답변 1"));
        clock.advance(Duration.ofMinutes(50));
        clocked.add(CONVERSATION, turn("질문 2", "답변 2"));
        clock.advance(Duration.ofMinutes(50));

        // when
        int evicted = clocked.evictIdle(Duration.ofHours(1));

        // then
        assertThat(evicted).isZero();
        assertThat(clocked.get(CONVERSATION)).hasSize(4);
    }

    @Test
    @DisplayName("관리 중인 대화 수를 센다")
    void countsManagedConversations() {
        // given
        memory.add(CONVERSATION, turn("질문", "답변"));
        memory.remember(ANOTHER_CONVERSATION, context("웨딩홀 후보 정하기"));

        // then
        assertThat(memory.conversationCount()).isEqualTo(2);
    }

    private static final class MutableClock extends Clock {

        private Instant now = Instant.parse("2026-10-15T00:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private static List<Message> turn(String question, String answer) {
        return List.of(new UserMessage(question), new AssistantMessage(answer));
    }

    private static BibbidiCustomChatPromptContext context(String itemTitle) {
        return new BibbidiCustomChatPromptContext(
                ChecklistSnapshot.notFound(),
                List.of(new CatalogItemDetailSnapshot(1L, itemTitle, "웨딩홀", 1, "후보")),
                Set.of(1L)
        );
    }
}
