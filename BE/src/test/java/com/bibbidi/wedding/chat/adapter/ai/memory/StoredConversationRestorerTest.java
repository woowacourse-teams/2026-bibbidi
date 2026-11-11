package com.bibbidi.wedding.chat.adapter.ai.memory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.chat.adapter.ai.config.AiChatProperties;
import com.bibbidi.wedding.chat.domain.ChatTurnOutcome;
import com.bibbidi.wedding.chat.domain.ChatTurnRecord;
import com.bibbidi.wedding.chat.service.ConversationHistoryService;
import com.bibbidi.wedding.chat.service.ConversationKey;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;

class StoredConversationRestorerTest {

    private static final Long USER_ID = 7L;
    private static final UUID CONVERSATION_ID = UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea99");
    private static final String KEY = USER_ID + ":" + CONVERSATION_ID;
    private static final int MEMORY_MAX_MESSAGES = 20;

    private ChatMemory chatMemory;
    private ConversationHistoryService historyService;
    private StoredConversationRestorer restorer;

    @BeforeEach
    void setUp() {
        chatMemory = MessageWindowChatMemory.builder()
                .chatMemoryRepository(new InMemoryChatMemoryRepository())
                .maxMessages(MEMORY_MAX_MESSAGES)
                .build();
        historyService = mock(ConversationHistoryService.class);
        AiChatProperties properties = new AiChatProperties(
                MEMORY_MAX_MESSAGES, Duration.ofHours(1), "qwen", "sol", "luna");
        restorer = new StoredConversationRestorer(chatMemory, historyService, properties);
    }

    @Test
    @DisplayName("기억이 없으면 저장된 턴을 질문과 답변 순서의 메시지로 복원한다")
    void restoresStoredTurnsWhenMemoryIsEmpty() {
        // given
        when(historyService.findRecentCompletedTurns(
                new ConversationKey(USER_ID, CONVERSATION_ID), MEMORY_MAX_MESSAGES / 2))
                .thenReturn(List.of(turn("예식일은 12월 5일이야", "알겠습니다."), turn("홀 추천해줘", "추천드릴게요.")));

        // when
        restorer.restoreIfAbsent(KEY);

        // then
        List<Message> restored = chatMemory.get(KEY);
        assertThat(restored).extracting(Message::getText)
                .containsExactly("예식일은 12월 5일이야", "알겠습니다.", "홀 추천해줘", "추천드릴게요.");
        assertThat(restored).extracting(Message::getMessageType)
                .containsExactly(
                        new UserMessage("").getMessageType(), new AssistantMessage("").getMessageType(),
                        new UserMessage("").getMessageType(), new AssistantMessage("").getMessageType());
    }

    @Test
    @DisplayName("기억이 남아 있으면 저장소를 조회하지 않고 기존 기억을 유지한다")
    void keepsExistingMemoryWithoutQueryingTheStore() {
        // given
        chatMemory.add(KEY, List.of(new UserMessage("메모리 질문"), new AssistantMessage("메모리 답변")));

        // when
        restorer.restoreIfAbsent(KEY);

        // then
        verify(historyService, never()).findRecentCompletedTurns(any(), anyInt());
        assertThat(chatMemory.get(KEY)).extracting(Message::getText).containsExactly("메모리 질문", "메모리 답변");
    }

    @Test
    @DisplayName("저장된 턴이 없으면 기억을 비워 둔다")
    void leavesMemoryEmptyWhenNothingIsStored() {
        // given
        when(historyService.findRecentCompletedTurns(any(), anyInt())).thenReturn(List.of());

        // when
        restorer.restoreIfAbsent(KEY);

        // then
        assertThat(chatMemory.get(KEY)).isEmpty();
    }

    private ChatTurnRecord turn(String prompt, String completion) {
        return new ChatTurnRecord(USER_ID, CONVERSATION_ID, prompt, completion, "LOW",
                ChatTurnOutcome.COMPLETED, null, LocalDateTime.of(2026, 11, 11, 9, 0), 100);
    }
}
