package com.bibbidi.wedding.user.controller;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CreateUserRequestTest {

    @Test
    void redactsPasswordFromStringRepresentation() {
        CreateUserRequest request = new CreateUserRequest("bibbidi", "raw-password");

        assertThat(request.toString())
                .contains("bibbidi", "[REDACTED]")
                .doesNotContain("raw-password");
    }
}
