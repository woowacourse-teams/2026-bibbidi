package com.bibbidi.wedding;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.support.TestDatabaseLocks;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "auth.jwt.secret=test-only-jwt-secret-value-for-bibbidi-auth",
        "bibbidi.balance-game.questions-location=classpath:balance-game/test-questions.json"
})
@ResourceLock(TestDatabaseLocks.DATA_LOAD_TEST)
class DevelopmentProfileH2ConsoleTest {

    @LocalServerPort
    private int port;

    @Test
    void opensH2ConsoleWithoutAccessToken() throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/h2-console/")).build();

        try (HttpClient client = HttpClient.newHttpClient()) {
            HttpResponse<String> response = client.send(request, BodyHandlers.ofString());

            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.headers().firstValue("X-Frame-Options")).hasValue("SAMEORIGIN");
        }
    }
}
