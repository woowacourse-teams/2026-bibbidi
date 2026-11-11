package com.bibbidi.wedding.chat.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ConversationKeyTest {

    @Test
    @DisplayName("기억 키를 사용자와 대화 ID로 되돌린다")
    void restoresKeyFromMemoryKey() {
        ConversationKey key = new ConversationKey(7L, UUID.fromString("7bf4d204-8331-439b-bd8f-271abc0eea99"));

        assertThat(ConversationKey.fromMemoryKey(key.toMemoryKey())).isEqualTo(key);
    }
}
