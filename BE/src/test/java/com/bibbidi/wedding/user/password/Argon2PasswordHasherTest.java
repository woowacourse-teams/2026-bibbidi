package com.bibbidi.wedding.user.password;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class Argon2PasswordHasherTest {

    private final Argon2PasswordHasher passwordHasher = new Argon2PasswordHasher();

    @Test
    @DisplayName("비밀번호를 해시하면 Argon2id 형식으로 저장되고 원문과 일치 여부를 확인할 수 있다")
    void shouldHashAndMatchWhenPasswordIsProvided() {
        String passwordHash = passwordHasher.hash("wish");

        assertThat(passwordHash)
                .startsWith("$argon2id$")
                .doesNotContain("wish");
        assertThat(passwordHasher.matches("wish", passwordHash)).isTrue();
        assertThat(passwordHasher.matches("wrong", passwordHash)).isFalse();
    }
}
