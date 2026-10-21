package com.bibbidi.wedding.chat.adapter.ai.loadtest;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.service.parser.ChatAnswerStream;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.boot.context.annotation.UserConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import reactor.test.StepVerifier;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;
import tools.jackson.databind.json.JsonMapper;

class LoadTestChatModelTest {

    private static final Prompt PROMPT = new Prompt("안녕");

    @Test
    void 설정한_토큰_수만큼_흘리고_끝난다() {
        LoadTestChatModel model = new LoadTestChatModel(
                new LoadTestChatModelProperties(1, 1, 3, 0), () -> 0.5);

        StepVerifier.create(model.stream(PROMPT))
                .expectNextCount(3)
                .expectComplete()
                .verify(Duration.ofSeconds(2));
    }

    @Test
    void 서비스가_읽는_구조화된_응답으로_흘린다() {
        LoadTestChatModel model = new LoadTestChatModel(
                new LoadTestChatModelProperties(1, 1, 3, 0), () -> 0.5);
        List<String> chunks = model.stream(PROMPT)
                .map(response -> response.getResult().getOutput().getText())
                .collectList()
                .block(Duration.ofSeconds(2));

        var answer = new ChatAnswerStream(JsonMapper.builder().build()).read(chunks.stream(), delta -> { });

        assertThat(answer.answer()).isEqualTo("토큰0 토큰1 토큰2 ");
        assertThat(answer.recommendedItemIds()).isEmpty();
    }

    @Test
    void 스로틀_비율에_걸리면_한도_초과_예외로_실패한다() {
        LoadTestChatModel model = new LoadTestChatModel(
                new LoadTestChatModelProperties(1, 1, 3, 0.2), () -> 0.1);

        StepVerifier.create(model.stream(PROMPT))
                .expectError(ThrottlingException.class)
                .verify(Duration.ofSeconds(2));
    }

    @Test
    void 스로틀_비율에_걸리지_않으면_정상_응답한다() {
        LoadTestChatModel model = new LoadTestChatModel(
                new LoadTestChatModelProperties(1, 1, 2, 0.2), () -> 0.2);

        StepVerifier.create(model.stream(PROMPT))
                .expectNextCount(2)
                .expectComplete()
                .verify(Duration.ofSeconds(2));
    }

    @Test
    void loadtest_프로필에서만_모델_빈이_등록된다() {
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withConfiguration(UserConfigurations.of(LoadTestChatModelConfig.class));

        runner.run(context -> assertThat(context).doesNotHaveBean(ChatModel.class));
        runner.withPropertyValues("spring.profiles.active=loadtest")
                .run(context -> assertThat(context).hasSingleBean(ChatModel.class));
    }
}
