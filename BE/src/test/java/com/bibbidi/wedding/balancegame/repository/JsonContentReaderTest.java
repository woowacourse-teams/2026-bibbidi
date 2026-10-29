package com.bibbidi.wedding.balancegame.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import com.bibbidi.wedding.balancegame.controller.dto.BalanceGameQuestionsResponse;
import com.bibbidi.wedding.balancegame.domain.Option;
import com.bibbidi.wedding.balancegame.domain.Question;
import com.bibbidi.wedding.balancegame.domain.Questions;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.core.io.ResourceLoader;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

class JsonContentReaderTest {

    private static final String IMAGE_BASE_URL = "https://techcourse-project-2026.s3.ap-northeast-2.amazonaws.com/"
            + "bibbidi/be/balance-game/question/";

    @Test
    @DisplayName("배포용 JSON의 10문항·20개 선택지 이미지 주소를 읽어 응답에 담는다")
    void shouldReadAllQuestionImagesFromDeploymentContent() throws IOException {
        JsonContentReader reader = new JsonContentReader(new DefaultResourceLoader(), JsonMapper.builder().build());
        String location = Path.of("content/balance-game/questions-with-images.json").toUri().toString();

        List<Question> questions = reader.readList(location, Question.class);
        BalanceGameQuestionsResponse response = BalanceGameQuestionsResponse.from(new Questions(questions));

        assertThat(questions).extracting(Question::id)
                .containsExactly("Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10");
        for (Question question : questions) {
            assertThat(question.options()).extracting(Option::id).containsExactly("A", "B");
        }
        List<String> imageUrls = questions.stream()
                .flatMap(question -> question.options().stream())
                .map(Option::imageUrl)
                .toList();
        assertThat(imageUrls).hasSize(20).doesNotHaveDuplicates()
                .allSatisfy(url -> assertThat(url).startsWith(IMAGE_BASE_URL).endsWith(".webp"));
        assertThat(imageUrls.getFirst()).isEqualTo(IMAGE_BASE_URL + "01_A_beach.webp");
        assertThat(imageUrls.getLast()).isEqualTo(IMAGE_BASE_URL + "10_B_subway_sleep.webp");
        assertThat(response.questions().stream().flatMap(question -> question.options().stream())
                .map(BalanceGameQuestionsResponse.OptionResponse::imageUrl))
                .containsExactlyElementsOf(imageUrls);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", ", \"imageUrl\": null"})
    @DisplayName("이미지 주소가 없거나 null이면 문항 JSON을 거절한다")
    void shouldRejectMissingOrNullImageUrl(String imageProperty) {
        String json = """
                [{"id":"Q1","text":"질문","options":[{"id":"A","text":"선택지"%s}]}]
                """.formatted(imageProperty);

        assertThatThrownBy(() -> readerFor(json).readList("test-content", Question.class))
                .isInstanceOf(JacksonException.class)
                .hasMessageContaining("imageUrl");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"text\":\"선택지\",\"imageUrl\":\"https://example.com/a.webp\"}",
            "{\"id\":null,\"text\":\"선택지\",\"imageUrl\":\"https://example.com/a.webp\"}",
            "{\"id\":\"A\",\"imageUrl\":\"https://example.com/a.webp\"}",
            "{\"id\":\"A\",\"text\":null,\"imageUrl\":\"https://example.com/a.webp\"}",
            "{\"id\":\"A\",\"text\":\"선택지\",\"imageUrl\":\"https://example.com/a.webp\",\"unknown\":true}",
            "{\"id\":\"A\",\"text\":\"선택지\",\"imageUrl\":\"https://example.com/a.webp\",\"imageUrl\":\"duplicate\"}"
    })
    @DisplayName("기존 필수 필드 누락·null과 알 수 없는 필드·중복 필드를 계속 거절한다")
    void shouldKeepRejectingInvalidOptionContent(String optionJson) {
        String json = """
                [{"id":"Q1","text":"질문","options":[%s]}]
                """.formatted(optionJson);

        assertThatThrownBy(() -> readerFor(json).readList("test-content", Question.class))
                .isInstanceOf(JacksonException.class);
    }

    private JsonContentReader readerFor(String json) {
        ByteArrayResource content = new ByteArrayResource(json.getBytes(StandardCharsets.UTF_8));
        ResourceLoader loader = mock(ResourceLoader.class);
        given(loader.getResource("test-content")).willReturn(content);
        return new JsonContentReader(loader, JsonMapper.builder().build());
    }
}
