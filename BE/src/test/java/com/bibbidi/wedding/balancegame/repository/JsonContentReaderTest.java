package com.bibbidi.wedding.balancegame.repository;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import com.bibbidi.wedding.balancegame.domain.Question;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ResourceLoader;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

class JsonContentReaderTest {

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
