package com.bibbidi.wedding.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.chat.service.dto.ChatResult;
import com.bibbidi.wedding.chat.service.tools.ChecklistTools;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import reactor.core.publisher.Flux;
import reactor.test.publisher.TestPublisher;

class AiChatServiceTest {

    private static final UUID CONVERSATION_ID = UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea99");
    private ChatModel model;
    private ChatMemory memory;
    private AiChatService service;
    private ChatReplyHandler reply;

    @BeforeEach
    void setUp() {
        model = mock(ChatModel.class);
        when(model.getOptions()).thenReturn(ToolCallingChatOptions.builder().build());
        memory = MessageWindowChatMemory.builder().maxMessages(20).build();
        service = new AiChatService(ChatClient.create(model), memory);
        reply = mock(ChatReplyHandler.class);
        doAnswer(invocation -> {
            invocation.<Runnable>getArgument(1).run();
            return null;
        }).when(reply).complete(any(ChatResult.class), any(Runnable.class));
    }

    @Test
    void streamsChunksAndRecordsOnlyTheCompletedTurn() {
        var publisher = TestPublisher.<ChatResponse>create();
        var subscribed = new CountDownLatch(1);
        var prompt = new AtomicReference<Prompt>();
        when(model.stream(any(Prompt.class))).thenAnswer(invocation -> {
            prompt.set(invocation.getArgument(0));
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return publisher.flux().doOnSubscribe(ignored -> subscribed.countDown());
        });

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var task = executor.submit(() -> service.chat(7L, null, "다음 할 일은?", reply));
            await().until(() -> subscribed.getCount() == 0);
            var id = ArgumentCaptor.forClass(String.class);
            verify(reply).conversation(id.capture());
            assertThat(UUID.fromString(id.getValue())).isNotNull();
            String key = "7:" + id.getValue();

            publisher.next(response("웨딩홀 "));
            await().untilAsserted(() -> verify(reply).sendAnswerChunk("웨딩홀 "));
            assertThat(memory.get(key)).isEmpty();
            publisher.next(response("계약을 확인하세요."));
            await().untilAsserted(() -> verify(reply).sendAnswerChunk("계약을 확인하세요."));
            publisher.complete();
            await().until(task::isDone);
            assertThat(task).isNotCancelled();
            assertThat(memory.get(key)).extracting(message -> message.getText())
                    .containsExactly("다음 할 일은?", "웨딩홀 계약을 확인하세요.");
            var options = (ToolCallingChatOptions) prompt.get().getOptions();
            assertThat(options.getToolContext()).containsEntry(ChecklistTools.USER_ID, 7L);
        }
    }

    @Test
    void reusesOnlyTheSameUsersConversationHistory() {
        memory.add("7:" + CONVERSATION_ID, List.of(new UserMessage("예산은 1000"), new AssistantMessage("알겠습니다.")));
        var prompts = new CopyOnWriteArrayList<Prompt>();
        when(model.stream(any(Prompt.class))).thenAnswer(invocation -> {
            prompts.add(invocation.getArgument(0));
            return Flux.just(response("답변"));
        });

        service.chat(7L, CONVERSATION_ID, "추천해줘", reply);
        service.chat(8L, CONVERSATION_ID, "추천해줘", reply);
        service.chat(7L, UUID.randomUUID(), "추천해줘", reply);

        assertThat(prompts.getFirst().getInstructions()).extracting(message -> message.getText())
                .containsExactly("예산은 1000", "알겠습니다.", "추천해줘");
        assertThat(prompts.get(1).getInstructions()).extracting(message -> message.getText()).containsExactly("추천해줘");
        assertThat(prompts.get(2).getInstructions()).extracting(message -> message.getText()).containsExactly("추천해줘");
    }

    @Test
    void userTextWithBracesIsPassedAsLiteralContent() {
        String question = "예산 {예산}과 조건 {\"촬영\":false}를 참고해줘";
        when(model.stream(any(Prompt.class))).thenAnswer(invocation -> {
            Prompt prompt = invocation.getArgument(0);
            assertThat(prompt.getInstructions().getLast().getText()).isEqualTo(question);
            return Flux.just(response("확인했어요."));
        });
        service.chat(7L, null, question, reply);
        verify(reply).sendAnswerChunk("확인했어요.");
    }

    @Test
    void errorsDoNotRecordPartialAnswersAndReleaseTheConversation() {
        var publisher = TestPublisher.<ChatResponse>create();
        var subscribed = new CountDownLatch(1);
        when(model.stream(any(Prompt.class))).thenReturn(publisher.flux().doOnSubscribe(ignored -> subscribed.countDown()));
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var error = new AtomicReference<Throwable>();
            var task = executor.submit(() -> {
                try {
                    service.chat(7L, CONVERSATION_ID, "질문", reply);
                } catch (RuntimeException exception) {
                    error.set(exception);
                }
            });
            await().until(() -> subscribed.getCount() == 0);
            publisher.next(response("일부 답변"));
            await().untilAsserted(() -> verify(reply).sendAnswerChunk("일부 답변"));
            publisher.error(new IllegalStateException("비공개 제공사 오류"));
            await().until(task::isDone);
            assertThat(error.get()).isInstanceOf(IllegalStateException.class);
            assertThat(memory.get("7:" + CONVERSATION_ID)).isEmpty();
        }

        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("새 답변")));
        service.chat(7L, CONVERSATION_ID, "다시 질문", reply);
        assertThat(memory.get("7:" + CONVERSATION_ID)).extracting(message -> message.getText())
                .containsExactly("다시 질문", "새 답변");
    }

    @Test
    void emptyOrBlankAnswersDoNotRecordATurn() {
        when(model.stream(any(Prompt.class))).thenReturn(Flux.empty());
        assertThatThrownBy(() -> service.chat(7L, CONVERSATION_ID, "질문", reply)).isInstanceOf(IllegalStateException.class);
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response(" \n ")));
        assertThatThrownBy(() -> service.chat(7L, CONVERSATION_ID, "질문", reply)).isInstanceOf(IllegalStateException.class);
        assertThat(memory.get("7:" + CONVERSATION_ID)).isEmpty();
    }

    @Test
    void closedReplyDoesNotRecordTheCompletedAnswer() {
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("완성된 답변")));
        doThrow(new CancellationException("연결 종료")).when(reply).complete(any(ChatResult.class), any(Runnable.class));
        assertThatThrownBy(() -> service.chat(7L, CONVERSATION_ID, "질문", reply)).isInstanceOf(CancellationException.class);
        assertThat(memory.get("7:" + CONVERSATION_ID)).isEmpty();
    }

    @Test
    void interruptCancelsTheModelAndDiscardsLateResults() {
        var publisher = TestPublisher.<ChatResponse>createNoncompliant(TestPublisher.Violation.DEFER_CANCELLATION);
        var subscribed = new CountDownLatch(1);
        var finished = new AtomicBoolean();
        when(model.stream(any(Prompt.class))).thenReturn(publisher.flux().doOnSubscribe(ignored -> subscribed.countDown()));
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var task = executor.submit(() -> {
                try {
                    service.chat(7L, CONVERSATION_ID, "질문", reply);
                } finally {
                    finished.set(true);
                }
            });
            await().until(() -> subscribed.getCount() == 0);
            publisher.next(response("중단할 답변"));
            await().untilAsserted(() -> verify(reply).sendAnswerChunk("중단할 답변"));
            task.cancel(true);
            await().untilAsserted(publisher::assertCancelled);
            await().untilTrue(finished);
            publisher.next(response("늦은 답변")).complete();
            assertThat(memory.get("7:" + CONVERSATION_ID)).isEmpty();
        }
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("재시도")));
        service.chat(7L, CONVERSATION_ID, "재요청", reply);
        assertThat(memory.get("7:" + CONVERSATION_ID)).extracting(message -> message.getText()).containsExactly("재요청", "재시도");
    }

    @Test
    void rejectsConcurrentRequestsForOnlyTheSameConversation() {
        var publisher = TestPublisher.<ChatResponse>create();
        var subscribed = new CountDownLatch(1);
        var finished = new AtomicBoolean();
        when(model.stream(any(Prompt.class))).thenReturn(publisher.flux().doOnSubscribe(ignored -> subscribed.countDown()));
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var task = executor.submit(() -> {
                try {
                    service.chat(7L, CONVERSATION_ID, "첫 요청", reply);
                } finally {
                    finished.set(true);
                }
            });
            await().until(() -> subscribed.getCount() == 0);
            assertThatThrownBy(() -> service.chat(7L, CONVERSATION_ID, "중복 요청", reply)).isInstanceOf(IllegalStateException.class);
            when(model.stream(any(Prompt.class))).thenReturn(Flux.just(response("다른 사용자")));
            service.chat(8L, CONVERSATION_ID, "다른 사용자", reply);
            task.cancel(true);
            await().untilTrue(finished);
            assertThat(memory.get("7:" + CONVERSATION_ID)).isEmpty();
            assertThat(memory.get("8:" + CONVERSATION_ID)).extracting(message -> message.getText())
                    .containsExactly("다른 사용자", "다른 사용자");
        }
    }

    private static ChatResponse response(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }
}
