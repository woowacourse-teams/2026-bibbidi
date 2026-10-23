package com.bibbidi.wedding.chat.adapter.ai.prompt;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

class SystemPromptTest {

    @Test
    @DisplayName("프롬프트 파일을 UTF-8로 읽어 내용을 그대로 돌려준다")
    void loadsPromptFileAsUtf8() throws IOException {
        String expected = new ClassPathResource("prompts/ai-chat-system.txt")
                .getContentAsString(StandardCharsets.UTF_8);

        SystemPrompt systemPrompt = new SystemPrompt();

        assertThat(systemPrompt.text()).isEqualTo(expected);
    }

    @Test
    @DisplayName("읽은 프롬프트는 비어 있지 않고 한글이 깨지지 않는다")
    void loadedPromptIsNotBlankAndKeepsKorean() {
        SystemPrompt systemPrompt = new SystemPrompt();

        assertThat(systemPrompt.text()).isNotBlank()
                .contains("비비디")
                .doesNotContain("�");
    }
}
