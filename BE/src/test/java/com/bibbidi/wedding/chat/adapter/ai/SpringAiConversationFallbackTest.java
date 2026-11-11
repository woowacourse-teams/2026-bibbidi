package com.bibbidi.wedding.chat.adapter.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelTarget;
import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelRouter;
import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import com.bibbidi.wedding.chat.adapter.ai.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelClassifier;
import com.bibbidi.wedding.chat.adapter.ai.tools.AppointmentServiceAdapter;
import com.bibbidi.wedding.chat.adapter.ai.tools.ChecklistServiceAdapter;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.chat.support.FakeChatModel;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.checklist.service.AppointmentService;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCompletionCommand;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.checklist.service.dto.AppointmentUpdateCommand;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.prompt.Prompt;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import tools.jackson.databind.json.JsonMapper;

class SpringAiConversationFallbackTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();
    private static final String CONVERSATION = "7:fallback";

    private final ChatMemory memory = MessageWindowChatMemory.builder()
            .chatMemoryRepository(new InMemoryChatMemoryRepository())
            .maxMessages(18)
            .build();
    private final List<ChatModelTier> calls = new ArrayList<>();

    @Test
    void triesEachTierOnceStartingFromTheChosenOne() {
        assertThat(ChatModelTier.LOW.fallbackOrder()).containsExactly(
                ChatModelTier.LOW, ChatModelTier.MEDIUM, ChatModelTier.HIGH);
        assertThat(ChatModelTier.MEDIUM.fallbackOrder()).containsExactly(
                ChatModelTier.MEDIUM, ChatModelTier.HIGH, ChatModelTier.LOW);
        assertThat(ChatModelTier.HIGH.fallbackOrder()).containsExactly(
                ChatModelTier.HIGH, ChatModelTier.MEDIUM, ChatModelTier.LOW);
    }

    @Test
    void retriesHigherTierAndKeepsOnlySuccessfulTurnInMemory() {
        IllegalStateException failure = new IllegalStateException("qwen failed");
        SpringAiConversationAdapter adapter = adapter(ChatModelTier.LOW, Map.of(
                ChatModelTier.LOW, prompt -> Flux.error(failure),
                ChatModelTier.MEDIUM, prompt -> {
                    assertThat(prompt.getInstructions()).extracting(Message::getText).containsExactly("질문");
                    return answer("대체 답변");
                },
                ChatModelTier.HIGH, prompt -> Flux.error(new AssertionError("HIGH는 호출하지 않아야 한다"))));

        List<ChatResult> results = adapter.stream(7L, CONVERSATION, "질문").collectList().block();

        assertThat(calls).containsExactly(ChatModelTier.LOW, ChatModelTier.MEDIUM);
        assertThat(results).containsExactly(
                new ChatResult.Selected(ChatModelTier.LOW), new ChatResult.Selected(ChatModelTier.MEDIUM),
                new ChatResult.Delta("대체 답변"), new ChatResult.Answer("대체 답변", List.of()));
        assertThat(memory.get(CONVERSATION)).extracting(Message::getText)
                .containsExactly("질문", answerJson("대체 답변"));
    }

    @Test
    void fallsBackToTheRemainingTierWithoutRetryingAFailedOne() {
        SpringAiConversationAdapter adapter = adapter(ChatModelTier.MEDIUM, Map.of(
                ChatModelTier.LOW, prompt -> answer("qwen 답변"),
                ChatModelTier.MEDIUM, prompt -> Flux.error(new IllegalStateException("luna failed")),
                ChatModelTier.HIGH, prompt -> Flux.error(new IllegalStateException("sol failed"))));

        List<ChatResult> results = adapter.stream(7L, CONVERSATION, "질문").collectList().block();

        assertThat(calls).containsExactly(ChatModelTier.MEDIUM, ChatModelTier.HIGH, ChatModelTier.LOW);
        assertThat(results.getLast()).isEqualTo(new ChatResult.Answer("qwen 답변", List.of()));
        assertThat(memory.get(CONVERSATION)).extracting(Message::getText)
                .containsExactly("질문", answerJson("qwen 답변"));
    }

    @Test
    void stopsWhenNoLowerTierRemains() {
        IllegalStateException failure = new IllegalStateException("all failed");
        SpringAiConversationAdapter adapter = adapter(ChatModelTier.HIGH, Map.of(
                ChatModelTier.LOW, prompt -> Flux.error(failure),
                ChatModelTier.MEDIUM, prompt -> Flux.error(failure),
                ChatModelTier.HIGH, prompt -> Flux.error(failure)));

        assertThatThrownBy(() -> adapter.stream(7L, CONVERSATION, "질문").blockLast())
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.clientError()).isEqualTo(ClientError.INTERNAL_ERROR));
        assertThat(calls).containsExactly(ChatModelTier.HIGH, ChatModelTier.MEDIUM, ChatModelTier.LOW);
    }

    @Test
    void doesNotRetryAfterSendingPartOfTheAnswer() {
        IllegalStateException failure = new IllegalStateException("stream failed");
        SpringAiConversationAdapter adapter = adapter(ChatModelTier.LOW, Map.of(
                ChatModelTier.LOW, prompt -> Flux.concat(
                        Flux.just(chunk("{\"answer\":\"일부")), Flux.error(failure)),
                ChatModelTier.MEDIUM, prompt -> Flux.error(new AssertionError("MEDIUM은 호출하지 않아야 한다")),
                ChatModelTier.HIGH, prompt -> Flux.error(new AssertionError("HIGH는 호출하지 않아야 한다"))));
        List<ChatResult> events = new ArrayList<>();

        assertThatThrownBy(() -> adapter.stream(7L, CONVERSATION, "질문")
                .doOnNext(events::add).blockLast())
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.clientError()).isEqualTo(ClientError.INTERNAL_ERROR));

        assertThat(calls).containsExactly(ChatModelTier.LOW);
        assertThat(events).containsExactly(new ChatResult.Selected(ChatModelTier.LOW), new ChatResult.Delta("일부"));
    }

    @ParameterizedTest
    @MethodSource("writeTools")
    void doesNotFallbackAfterExecutingAWritingTool(String toolName, String arguments) {
        ChecklistService checklist = mock(ChecklistService.class);
        AppointmentService appointments = mock(AppointmentService.class);
        SpringAiConversationAdapter adapter = adapter(ChatModelTier.LOW, Map.of(
                ChatModelTier.LOW, prompt -> hasToolResult(prompt)
                        ? Flux.error(new IllegalStateException("응답 스트림 실패"))
                        : toolCall(toolName, arguments),
                ChatModelTier.MEDIUM, prompt -> answer("중복 실행하면 안 된다")),
                new ChecklistServiceAdapter(checklist), new AppointmentServiceAdapter(appointments));

        assertThatThrownBy(() -> adapter.stream(7L, CONVERSATION, "변경해줘").blockLast())
                .isInstanceOf(BusinessException.class);

        assertThat(calls).containsExactly(ChatModelTier.LOW, ChatModelTier.LOW);
        switch (toolName) {
            case "changeChecklistItemStatus" -> verify(checklist).changeItemStatus(7L, 10L, "done");
            case "changeChecklistItemTitle" -> verify(checklist).changeItemTitle(7L, 10L, "새 이름");
            case "deleteChecklistItem" -> verify(checklist).deleteItem(7L, 10L);
            case "createAppointment" -> verify(appointments).create(any(AppointmentCreationCommand.class));
            case "updateAppointment" -> verify(appointments).update(any(AppointmentUpdateCommand.class));
            case "changeAppointmentDone" -> verify(appointments).changeStatus(any(AppointmentCompletionCommand.class));
            case "deleteAppointment" -> verify(appointments).delete(7L, 20L);
            default -> throw new AssertionError("알 수 없는 쓰기 도구: " + toolName);
        }
        verifyNoMoreInteractions(checklist, appointments);
    }

    @Test
    void doesNotFallbackEvenWhenTheWritingServiceThrows() {
        ChecklistService checklist = mock(ChecklistService.class);
        doThrow(new IllegalStateException("쓰기 결과를 확정할 수 없음")).when(checklist).deleteItem(7L, 10L);
        SpringAiConversationAdapter adapter = adapter(ChatModelTier.LOW, Map.of(
                ChatModelTier.LOW, prompt -> hasToolResult(prompt)
                        ? Flux.error(new IllegalStateException("응답 스트림 실패"))
                        : toolCall("deleteChecklistItem", "{\"checklistItemId\":10}"),
                ChatModelTier.MEDIUM, prompt -> answer("재실행하면 안 된다")),
                new ChecklistServiceAdapter(checklist));

        assertThatThrownBy(() -> adapter.stream(7L, CONVERSATION, "삭제해줘").blockLast())
                .isInstanceOf(BusinessException.class);

        assertThat(calls).isNotEmpty().containsOnly(ChatModelTier.LOW);
        verify(checklist).deleteItem(7L, 10L);
        verifyNoMoreInteractions(checklist);
    }

    @Test
    void stillFallsBackAfterExecutingOnlyAReadTool() {
        ChecklistService checklist = mock(ChecklistService.class);
        when(checklist.findMyChecklistIfPresent(7L)).thenReturn(Optional.empty());
        SpringAiConversationAdapter adapter = adapter(ChatModelTier.LOW, Map.of(
                ChatModelTier.LOW, prompt -> hasToolResult(prompt)
                        ? Flux.error(new IllegalStateException("응답 스트림 실패"))
                        : toolCall("getMyChecklist", "{}"),
                ChatModelTier.MEDIUM, prompt -> answer("조회 후 대체 답변")),
                new ChecklistServiceAdapter(checklist));

        assertThat(adapter.stream(7L, CONVERSATION, "조회해줘").collectList().block().getLast())
                .isEqualTo(new ChatResult.Answer("조회 후 대체 답변", List.of()));
        assertThat(calls).containsExactly(ChatModelTier.LOW, ChatModelTier.LOW, ChatModelTier.MEDIUM);
        verify(checklist).findMyChecklistIfPresent(7L);
    }

    private static Stream<Arguments> writeTools() {
        String appointment = "\"title\":\"일정\",\"date\":\"2026-11-01\"";
        return Stream.of(
                Arguments.of("changeChecklistItemStatus", "{\"checklistItemId\":10,\"status\":\"done\"}"),
                Arguments.of("changeChecklistItemTitle", "{\"checklistItemId\":10,\"title\":\"새 이름\"}"),
                Arguments.of("deleteChecklistItem", "{\"checklistItemId\":10}"),
                Arguments.of("createAppointment", "{\"checklistItemId\":10," + appointment + "}"),
                Arguments.of("updateAppointment", "{\"appointmentId\":20," + appointment + "}"),
                Arguments.of("changeAppointmentDone", "{\"appointmentId\":20,\"isDone\":true}"),
                Arguments.of("deleteAppointment", "{\"appointmentId\":20}"));
    }

    private static boolean hasToolResult(Prompt prompt) {
        return prompt.getInstructions().stream().anyMatch(ToolResponseMessage.class::isInstance);
    }

    private static Flux<ChatResponse> toolCall(String name, String arguments) {
        return Flux.just(new ChatResponse(List.of(new Generation(AssistantMessage.builder().content("")
                .toolCalls(List.of(new AssistantMessage.ToolCall("write-1", "function", name, arguments)))
                .build()))));
    }

    private SpringAiConversationAdapter adapter(ChatModelTier initial,
                                                 Map<ChatModelTier, Function<Prompt, Flux<ChatResponse>>> responses,
                                                 Object... tools) {
        Map<ChatModelTier, ChatModelTarget> targets = Map.of(
                ChatModelTier.LOW, target(ChatModelTier.LOW, responses, tools),
                ChatModelTier.MEDIUM, target(ChatModelTier.MEDIUM, responses, tools),
                ChatModelTier.HIGH, target(ChatModelTier.HIGH, responses, tools));
        ModelClassifier classifier = mock(ModelClassifier.class);
        when(classifier.classify(anyString(), anyString())).thenReturn(Mono.just(ModelClassifier.Classification.allow(initial)));
        return new SpringAiConversationAdapter(new SpringAiChatClient(new ChatModelRouter(targets)),
                new JacksonChatAnswerParser(MAPPER), memory, classifier);
    }

    private ChatModelTarget target(ChatModelTier tier,
                                 Map<ChatModelTier, Function<Prompt, Flux<ChatResponse>>> responses,
                                 Object... tools) {
        ChatClient client = ChatClient.builder(new FakeChatModel(prompt -> {
                    calls.add(tier);
                    return responses.get(tier).apply(prompt);
                }))
                .defaultTools(tools)
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(memory).build())
                .build();
        return new ChatModelTarget(client, tier.name().toLowerCase(), null);
    }

    private static Flux<ChatResponse> answer(String text) {
        return Flux.just(chunk(answerJson(text)));
    }

    private static String answerJson(String text) {
        return MAPPER.writeValueAsString(new ChatResult.Answer(text, List.of()));
    }

    private static ChatResponse chunk(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }
}
