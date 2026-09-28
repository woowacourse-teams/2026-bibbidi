package com.bibbidi.wedding.auth.password;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class Argon2PasswordHasherTest {

    private final Argon2PasswordHasher hasher = new Argon2PasswordHasher();

    @Test
    @DisplayName("원문 비밀번호를 그대로 저장하지 않고 해시로 변환한다")
    void shouldHashRawPasswordInsteadOfStoringItAsIs() {
        String hash = hasher.hash("wish");

        assertThat(hash).isNotEqualTo("wish");
    }

    @Test
    @DisplayName("원문 비밀번호와 해시가 일치하면 참을 반환한다")
    void shouldMatchWhenRawPasswordProducedTheHash() {
        String hash = hasher.hash("wish");

        assertThat(hasher.matches("wish", hash)).isTrue();
    }

    @Test
    @DisplayName("다른 비밀번호와는 해시가 일치하지 않는다")
    void shouldNotMatchWhenRawPasswordDidNotProduceTheHash() {
        String hash = hasher.hash("wish");

        assertThat(hasher.matches("wrong", hash)).isFalse();
    }
}
