package com.bibbidi.wedding.auth.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
import com.bibbidi.wedding.user.repository.UserRepository;
import com.bibbidi.wedding.user.service.PasswordHasher;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class AuthSessionIntegrationTest {

    private static final String PASSWORD = "wish";

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JpaUserRepository jpaUserRepository;

    @Autowired
    private PasswordHasher passwordHasher;

    private HttpClient httpClient;
    private User user;

    @BeforeEach
    void setUp() {
        jpaUserRepository.deleteAll();
        user = userRepository.save(User.create("bibbidi", passwordHasher.hash(PASSWORD)));
        httpClient = HttpClient.newHttpClient();
    }

    @AfterEach
    void cleanUp() {
        jpaUserRepository.deleteAll();
    }

    @Test
    @DisplayName("로그인 쿠키는 안전 속성을 사용하고 로그아웃 후 같은 쿠키로 인증할 수 없다")
    void shouldIssueSecurelyConfiguredCookieAndRejectItAfterLogout() throws Exception {
        HttpResponse<String> loginResponse = httpClient.send(
                request("/api/login")
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .POST(HttpRequest.BodyPublishers.ofString("""
                                {
                                  "nickname": "bibbidi",
                                  "password": "wish"
                                }
                                """))
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );

        assertThat(loginResponse.statusCode()).isEqualTo(200);
        String setCookie = loginResponse.headers()
                .firstValue(HttpHeaders.SET_COOKIE)
                .orElseThrow();
        String sessionCookie = setCookie.substring(0, setCookie.indexOf(';'));
        String sessionCookieName = sessionCookie.substring(0, sessionCookie.indexOf('='));
        String sessionId = sessionCookie.substring(sessionCookie.indexOf('=') + 1);

        assertThat(setCookie)
                .contains("Path=/")
                .contains("HttpOnly")
                .doesNotContain("Max-Age");
        assertThat(sessionCookieName).isEqualTo("JSESSIONID");
        assertThat(loginResponse.body())
                .contains("\"userId\":" + user.id())
                .contains("\"nickname\":\"bibbidi\"")
                .doesNotContain(PASSWORD)
                .doesNotContain(user.passwordHash())
                .doesNotContain(sessionId);

        HttpResponse<String> logoutResponse = sendLogout(sessionCookie);

        assertThat(logoutResponse.statusCode()).isEqualTo(204);
        assertThat(logoutResponse.body()).isEmpty();
        assertThat(logoutResponse.headers().firstValue(HttpHeaders.SET_COOKIE).orElseThrow())
                .startsWith(sessionCookieName + "=;")
                .contains("Path=/")
                .contains("Max-Age=0")
                .contains("HttpOnly")
                .doesNotContain(sessionId);

        HttpResponse<String> requestWithInvalidatedSession = sendLogout(sessionCookie);

        assertThat(requestWithInvalidatedSession.statusCode()).isEqualTo(401);
        assertThat(requestWithInvalidatedSession.body())
                .contains("\"id\":201")
                .contains("\"status\":401")
                .contains("\"message\":\"로그인이 필요합니다.\"")
                .doesNotContain(sessionId);
    }

    private HttpResponse<String> sendLogout(String sessionCookie) throws Exception {
        return httpClient.send(
                request("/api/logout")
                        .header(HttpHeaders.COOKIE, sessionCookie)
                        .DELETE()
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
    }
}
