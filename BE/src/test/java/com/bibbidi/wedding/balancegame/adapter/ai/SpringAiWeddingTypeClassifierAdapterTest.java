package com.bibbidi.wedding.balancegame.adapter.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.balancegame.domain.Answer;
import com.bibbidi.wedding.balancegame.domain.Option;
import com.bibbidi.wedding.balancegame.domain.Question;
import com.bibbidi.wedding.balancegame.domain.WeddingType;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.core.io.ByteArrayResource;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;

class SpringAiWeddingTypeClassifierAdapterTest {

    private static final WeddingType SIMPLE = new WeddingType(
            "SIMPLE", "담백한 미니멀파", "꼭 필요한 준비만 골라 담는 커플", "https://example.com/s.webp", List.of(1L));
    private static final WeddingType LUXURY = new WeddingType(
            "LUXURY", "한 번뿐인 날 풀코스파", "하나도 놓치지 않고 제대로 하고 싶은 커플", "https://example.com/l.webp", List.of(1L));
    private static final List<WeddingType> CANDIDATES = List.of(SIMPLE, LUXURY);
    private static final Question QUESTION = new Question("Q1", "기념일 데이트, 더 끌리는 쪽은?", List.of(
            new Option("A", "동네 단골집에서 편하게"),
            new Option("B", "한 달 전에 예약한 파인다이닝")
    ));
    private static final List<Answer> ANSWERS = List.of(QUESTION.answerFrom(Map.of("Q1", "B")).orElseThrow());

    private final ChatModel model = mock(ChatModel.class);
    private final AtomicReference<Prompt> captured = new AtomicReference<>();
    private SpringAiWeddingTypeClassifierAdapter adapter;

    @BeforeEach
    void setUp() {
        when(model.getOptions()).thenReturn(BedrockChatOptions.builder().model("default-model").build());
        adapter = new SpringAiWeddingTypeClassifierAdapter(
                ChatClient.builder(model),
                new ByteArrayResource("시스템 프롬프트".getBytes(StandardCharsets.UTF_8))
        );
    }

    @Test
    @DisplayName("답변 문구와 후보 유형을 보내고, AI가 고른 후보 유형을 돌려준다")
    void shouldReturnCandidateChosenByAi() {
        respond("{\"typeId\":\"LUXURY\"}");

        assertThat(adapter.classify(ANSWERS, CANDIDATES)).isEqualTo(LUXURY);

        Prompt prompt = captured.get();
        assertThat(prompt.getUserMessage().getText())
                .contains("기념일 데이트, 더 끌리는 쪽은? → 한 달 전에 예약한 파인다이닝")
                .contains("- SIMPLE: 담백한 미니멀파 (꼭 필요한 준비만 골라 담는 커플)")
                .contains("- LUXURY: 한 번뿐인 날 풀코스파 (하나도 놓치지 않고 제대로 하고 싶은 커플)");
    }

    @Test
    @DisplayName("AI 호출 한도를 넘으면 잠시 후 다시 시도하라는 오류로 처리한다")
    void shouldFailWithCapacityErrorWhenThrottled() {
        when(model.call(any(Prompt.class))).thenThrow(ThrottlingException.builder().message("throttled").build());

        assertThatThrownBy(() -> adapter.classify(ANSWERS, CANDIDATES))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.AI_CAPACITY_EXCEEDED);
    }

    private void respond(String output) {
        when(model.call(any(Prompt.class))).thenAnswer(invocation -> {
            captured.set(invocation.getArgument(0));
            return new ChatResponse(List.of(new Generation(new AssistantMessage(output))));
        });
    }
}
