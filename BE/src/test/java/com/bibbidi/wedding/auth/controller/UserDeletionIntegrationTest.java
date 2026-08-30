package com.bibbidi.wedding.auth.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.appointment.persistence.JpaAppointmentRepository;
import com.bibbidi.wedding.auth.controller.UserDeletionTestFixture.CatalogData;
import com.bibbidi.wedding.auth.controller.UserDeletionTestFixture.Scenario;
import com.bibbidi.wedding.auth.controller.UserDeletionTestFixture.UserWeddingData;
import com.bibbidi.wedding.auth.controller.dto.LoginRequest;
import com.bibbidi.wedding.auth.password.PasswordHasher;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemRepository;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryRepository;
import com.bibbidi.wedding.catalog.persistence.JpaStepRepository;
import com.bibbidi.wedding.checklist.controller.dto.CreateChecklistItemRequest;
import com.bibbidi.wedding.checklist.controller.dto.CreateChecklistItemResponse;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import com.bibbidi.wedding.user.controller.dto.DeleteUserRequest;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
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
class UserDeletionIntegrationTest {

    private static final String PASSWORD = "wish";

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JpaUserRepository userRepository;

    @Autowired
    private JpaChecklistRepository checklistRepository;

    @Autowired
    private JpaChecklistItemRepository checklistItemRepository;

    @Autowired
    private JpaAppointmentRepository appointmentRepository;

    @Autowired
    private JpaCategoryRepository categoryRepository;

    @Autowired
    private JpaStepRepository stepRepository;

    @Autowired
    private JpaCatalogItemRepository catalogItemRepository;

    @Autowired
    private PasswordHasher passwordHasher;

    private HttpClient httpClient;
    private UserDeletionTestFixture fixture;
    private Scenario scenario;

    @BeforeEach
    void setUp() {
        httpClient = HttpClient.newHttpClient();
        fixture = new UserDeletionTestFixture(
                userRepository,
                checklistRepository,
                checklistItemRepository,
                appointmentRepository,
                categoryRepository,
                stepRepository,
                catalogItemRepository,
                passwordHasher
        );
        fixture.clear();
        scenario = fixture.create("current", "other", PASSWORD);
    }

    @AfterEach
    void cleanUp() {
        fixture.clear();
    }

    @Test
    @DisplayName("회원 탈퇴는 현재 사용자의 결혼 준비 데이터만 삭제하고 준비 목록과 다른 사용자 데이터를 유지한다")
    void shouldDeleteOnlyCurrentUsersWeddingDataAndInvalidateSession() throws Exception {
        String sessionCookie = login("current");
        Long checklistItemId = createChecklistItem(sessionCookie);
        Long appointmentId = fixture.createAppointment(checklistItemId);
        OwnedWeddingData currentUsersData = new OwnedWeddingData(
                scenario.currentUser().checklistId(),
                checklistItemId,
                appointmentId
        );

        HttpResponse<String> deletionResponse = deleteCurrentUser(sessionCookie);

        assertThat(deletionResponse.statusCode()).isEqualTo(204);
        assertThat(deletionResponse.body()).isEmpty();
        assertThat(deletionResponse.headers().firstValue(HttpHeaders.SET_COOKIE).orElseThrow())
                .contains("Max-Age=0");
        assertCurrentUsersDataDeleted(scenario.currentUser().userId(), currentUsersData);
        assertOtherUsersDataRemains(scenario.otherUser());
        assertCatalogRemains(scenario.catalog());

        HttpResponse<String> previousSessionResponse = httpClient.send(
                request("/api/catalog", sessionCookie)
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );

        assertThat(previousSessionResponse.statusCode()).isEqualTo(401);
        assertThat(previousSessionResponse.body())
                .contains("\"errorCode\":201")
                .contains("\"message\":\"로그인이 필요합니다.\"");
    }

    private String login(String nickname) throws Exception {
        HttpResponse<String> loginResponse = sendJson(
                "/api/login",
                null,
                new LoginRequest(nickname, PASSWORD)
        );
        assertThat(loginResponse.statusCode()).isEqualTo(200);

        String setCookie = loginResponse.headers().firstValue(HttpHeaders.SET_COOKIE).orElseThrow();
        return setCookie.substring(0, setCookie.indexOf(';'));
    }

    private Long createChecklistItem(String sessionCookie) throws Exception {
        HttpResponse<String> checklistItemResponse = sendJson(
                "/api/checklists/me/items",
                sessionCookie,
                new CreateChecklistItemRequest("청첩장 문구 정하기", scenario.catalog().categoryId())
        );
        assertThat(checklistItemResponse.statusCode()).isEqualTo(201);
        CreateChecklistItemResponse checklistItem = objectMapper.readValue(
                checklistItemResponse.body(),
                CreateChecklistItemResponse.class
        );
        assertThat(checklistItem.catalogItemId()).isNull();

        return checklistItem.id();
    }

    private HttpResponse<String> deleteCurrentUser(String sessionCookie) throws Exception {
        return httpClient.send(
                request("/api/users/me", sessionCookie)
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .method(
                                "DELETE",
                                HttpRequest.BodyPublishers.ofString(
                                        objectMapper.writeValueAsString(new DeleteUserRequest(PASSWORD))
                                )
                        )
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
    }

    private HttpResponse<String> sendJson(String path, String sessionCookie, Object body) throws Exception {
        return httpClient.send(
                request(path, sessionCookie)
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
    }

    private HttpRequest.Builder request(String path, String sessionCookie) {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (sessionCookie != null) {
            request.header(HttpHeaders.COOKIE, sessionCookie);
        }
        return request;
    }

    private void assertCurrentUsersDataDeleted(Long userId, OwnedWeddingData data) {
        assertThat(userRepository.findById(userId)).isEmpty();
        assertThat(checklistRepository.findById(data.checklistId())).isEmpty();
        assertThat(checklistItemRepository.findById(data.checklistItemId())).isEmpty();
        assertThat(appointmentRepository.findById(data.appointmentId())).isEmpty();
    }

    private void assertOtherUsersDataRemains(UserWeddingData data) {
        assertThat(userRepository.findById(data.userId())).isPresent();
        assertThat(checklistRepository.findById(data.checklistId())).isPresent();
        assertThat(checklistItemRepository.findById(data.checklistItemId())).isPresent();
        assertThat(appointmentRepository.findById(data.appointmentId())).isPresent();
    }

    private void assertCatalogRemains(CatalogData catalog) {
        assertThat(categoryRepository.findById(catalog.categoryId())).isPresent();
        assertThat(stepRepository.findById(catalog.stepId())).isPresent();
        assertThat(catalogItemRepository.findById(catalog.catalogItemId())).isPresent();
    }

    private record OwnedWeddingData(
            Long checklistId,
            Long checklistItemId,
            Long appointmentId
    ) {
    }
}
