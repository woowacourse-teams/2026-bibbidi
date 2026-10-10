package com.bibbidi.wedding.chat.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.service.ChatReplyHandler;
import com.bibbidi.wedding.chat.service.dto.ChatResult;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.chat.client.autoconfigure.ChatClientAutoConfiguration;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.ai.model.tool.autoconfigure.ToolCallingAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import reactor.core.publisher.Flux;

class AiChatConfigTest {

    private final ChatModel model = mock(ChatModel.class);
    private final ChecklistService checklist = mock(ChecklistService.class);
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(ToolCallingAutoConfiguration.class, ChatClientAutoConfiguration.class))
            .withUserConfiguration(AiChatConfig.class)
            .withBean(ChatModel.class, () -> model)
            .withBean(CatalogService.class, () -> mock(CatalogService.class))
            .withBean(ChecklistService.class, () -> checklist)
            .withPropertyValues("bibbidi.ai.response-timeout=30s", "bibbidi.ai.memory-max-messages=20",
                    "spring.ai.tools.throw-exception-on-error=true");

    @Test
    void configuredToolLoopUsesAuthenticatedUserAndRemembersOnlyPublicMessages() {
        when(model.getOptions()).thenReturn(ToolCallingChatOptions.builder().build());
        when(checklist.findMyChecklist(7L)).thenReturn(new ChecklistWithAppointmentsResult(10L, List.of()));
        var calls = new AtomicInteger();
        when(model.stream(any(Prompt.class))).thenAnswer(invocation -> {
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            if (calls.incrementAndGet() == 1) {
                return Flux.just(toolCall());
            }
            Prompt prompt = invocation.getArgument(0);
            assertThat(prompt.getInstructions()).anyMatch(message -> message.getMessageType() == MessageType.TOOL);
            return Flux.just(new ChatResponse(List.of(new Generation(new AssistantMessage("확인했어요.")))));
        });
        runner.run(context -> {
            var memory = context.getBean(ChatMemory.class);
            var service = new AiChatService(context.getBean(ChatClient.class), memory);
            UUID id = UUID.randomUUID();
            var reply = mock(ChatReplyHandler.class);
            doAnswer(invocation -> {
                invocation.<Runnable>getArgument(1).run();
                return null;
            }).when(reply).complete(any(ChatResult.class), any(Runnable.class));
            service.chat(7L, id, "할 일 알려줘", reply);
            verify(reply).sendAnswerChunk("확인했어요.");
            assertThat(calls).hasValue(2);
            org.mockito.Mockito.verify(checklist).findMyChecklist(7L);
            assertThat(memory.get("7:" + id)).extracting(message -> message.getMessageType())
                    .containsExactly(MessageType.USER, MessageType.ASSISTANT);
        });
    }

    @Test
    void configuredToolFailureStopsGenerationRatherThanPretendingTheChecklistIsEmpty() {
        when(model.getOptions()).thenReturn(ToolCallingChatOptions.builder().build());
        when(checklist.findMyChecklist(7L)).thenThrow(new BusinessException(ClientError.INTERNAL_ERROR, "비공개 조회 장애"));
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(toolCall()));
        runner.run(context -> {
            var memory = context.getBean(ChatMemory.class);
            var service = new AiChatService(context.getBean(ChatClient.class), memory);
            UUID id = UUID.randomUUID();
            assertThatThrownBy(() -> service.chat(7L, id, "질문", mock(ChatReplyHandler.class)))
                    .isInstanceOf(org.springframework.ai.tool.execution.ToolExecutionException.class);
            org.mockito.Mockito.verify(model, org.mockito.Mockito.times(1)).stream(any(Prompt.class));
            assertThat(memory.get("7:" + id)).isEmpty();
        });
    }

    private static ChatResponse toolCall() {
        return new ChatResponse(List.of(new Generation(AssistantMessage.builder().content("")
                .toolCalls(List.of(new AssistantMessage.ToolCall("call-1", "function", "findMyChecklist", "{}")))
                .build())));
    }
}
