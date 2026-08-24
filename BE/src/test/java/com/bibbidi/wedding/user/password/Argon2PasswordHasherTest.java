package com.bibbidi.wedding.user.password;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class Argon2PasswordHasherTest {

    private final Argon2PasswordHasher passwordHasher = new Argon2PasswordHasher();

    @Test
    void hashesWithArgon2idAndMatchesRawPassword() {
        String passwordHash = passwordHasher.hash("wish");

        assertThat(passwordHash)
                .startsWith("$argon2id$")
                .doesNotContain("wish");
        assertThat(passwordHasher.matches("wish", passwordHash)).isTrue();
        assertThat(passwordHasher.matches("wrong", passwordHash)).isFalse();
    }
}
