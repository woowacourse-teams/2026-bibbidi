package com.bibbidi.wedding.auth.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.auth.controller.dto.LoginRequest;
import com.bibbidi.wedding.auth.password.PasswordHasher;
import com.bibbidi.wedding.user.controller.dto.DeleteUserRequest;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
import com.bibbidi.wedding.user.repository.UserRepository;
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
import tools.jackson.databind.ObjectMapper;

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

    @Autowired
    private ObjectMapper objectMapper;

    private HttpClient httpClient;
    private User user;

    @BeforeEach
    void setUp() {
        jpaUserRepository.deleteAll();
        user = userRepository.save(new User(null, "bibbidi", passwordHasher.hash(PASSWORD)));
        httpClient = HttpClient.newHttpClient();
    }

    @AfterEach
    void cleanUp() {
        jpaUserRepository.deleteAll();
    }

    @Test
    @DisplayName("로그인 쿠키는 안전 속성을 사용하고 로그아웃은 만료된 세션에도 멱등하게 동작한다")
    void shouldIssueSecurelyConfiguredCookieAndLogoutIdempotently() throws Exception {
        LoginRequest loginRequest = new LoginRequest("bibbidi", PASSWORD);

        HttpResponse<String> loginResponse = httpClient.send(
                request("/api/login")
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(loginRequest)))
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
                .contains("Secure")
                .contains("HttpOnly")
                .contains("SameSite=Lax")
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
                .contains("Secure")
                .doesNotContain(sessionId);

        HttpResponse<String> repeatedLogoutResponse = sendLogout(sessionCookie);

        assertThat(repeatedLogoutResponse.statusCode()).isEqualTo(204);
        assertThat(repeatedLogoutResponse.body()).isEmpty();
        assertThat(repeatedLogoutResponse.headers().firstValue(HttpHeaders.SET_COOKIE).orElseThrow())
                .startsWith(sessionCookieName + "=;")
                .contains("Path=/")
                .contains("Max-Age=0")
                .contains("Secure")
                .doesNotContain(sessionId);
    }

    @Test
    @DisplayName("회원 탈퇴 후 기존 Session Cookie로 보호 API에 다시 접근할 수 없다")
    void shouldRejectPreviousSessionCookieAfterUserDeletion() throws Exception {
        LoginRequest loginRequest = new LoginRequest("bibbidi", PASSWORD);
        HttpResponse<String> loginResponse = httpClient.send(
                request("/api/login")
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(loginRequest)))
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
        String setCookie = loginResponse.headers().firstValue(HttpHeaders.SET_COOKIE).orElseThrow();
        String sessionCookie = setCookie.substring(0, setCookie.indexOf(';'));
        DeleteUserRequest deleteUserRequest = new DeleteUserRequest(PASSWORD);

        HttpResponse<String> deletionResponse = httpClient.send(
                request("/api/users/me")
                        .header(HttpHeaders.COOKIE, sessionCookie)
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .method(
                                "DELETE",
                                HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(deleteUserRequest))
                        )
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );

        assertThat(deletionResponse.statusCode()).isEqualTo(204);
        assertThat(deletionResponse.body()).isEmpty();
        assertThat(deletionResponse.headers().firstValue(HttpHeaders.SET_COOKIE).orElseThrow())
                .contains("Max-Age=0");
        assertThat(jpaUserRepository.findById(user.id())).isEmpty();

        HttpResponse<String> previousSessionResponse = httpClient.send(
                request("/api/checklists")
                        .header(HttpHeaders.COOKIE, sessionCookie)
                        .POST(HttpRequest.BodyPublishers.noBody())
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );

        assertThat(previousSessionResponse.statusCode()).isEqualTo(401);
        assertThat(previousSessionResponse.body())
                .contains("\"errorCode\":201")
                .contains("\"message\":\"로그인이 필요합니다.\"");
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
