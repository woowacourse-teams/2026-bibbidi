package com.bibbidi.wedding.auth.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import org.junit.jupiter.api.Test;

class H2ConsoleSecurityIntegrationTest extends BibbidiIntegrationTest {

    @Test
    void rejectsH2ConsoleWhenConsoleIsDisabled() throws Exception {
        mockMvc.perform(get("/h2-console/"))
                .andExpect(status().isUnauthorized());
    }
}
