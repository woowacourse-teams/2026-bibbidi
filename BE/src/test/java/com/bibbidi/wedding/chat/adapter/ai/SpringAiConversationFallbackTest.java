package com.bibbidi.wedding.chat.adapter.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelTarget;
import com.bibbidi.wedding.chat.adapter.ai.client.ChatModelRouter;
import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import com.bibbidi.wedding.chat.adapter.ai.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import com.bibbidi.wedding.chat.adapter.ai.routing.ModelClassifier;
import com.bibbidi.wedding.chat.service.dto.result.ChatResult;
import com.bibbidi.wedding.chat.support.FakeChatModel;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.Message;
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

    private SpringAiConversationAdapter adapter(ChatModelTier initial,
                                                 Map<ChatModelTier, Function<Prompt, Flux<ChatResponse>>> responses) {
        Map<ChatModelTier, ChatModelTarget> targets = Map.of(
                ChatModelTier.LOW, target(ChatModelTier.LOW, responses),
                ChatModelTier.MEDIUM, target(ChatModelTier.MEDIUM, responses),
                ChatModelTier.HIGH, target(ChatModelTier.HIGH, responses));
        ModelClassifier classifier = mock(ModelClassifier.class);
        when(classifier.classify(anyString(), anyString())).thenReturn(Mono.just(initial));
        return new SpringAiConversationAdapter(new SpringAiChatClient(new ChatModelRouter(targets)),
                new JacksonChatAnswerParser(MAPPER), memory, classifier);
    }

    private ChatModelTarget target(ChatModelTier tier,
                                 Map<ChatModelTier, Function<Prompt, Flux<ChatResponse>>> responses) {
        ChatClient client = ChatClient.builder(new FakeChatModel(prompt -> {
                    calls.add(tier);
                    return responses.get(tier).apply(prompt);
                }))
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
