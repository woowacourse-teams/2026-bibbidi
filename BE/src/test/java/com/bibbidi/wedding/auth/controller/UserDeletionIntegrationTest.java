package com.bibbidi.wedding.auth.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.appointment.controller.dto.AppointmentResponse;
import com.bibbidi.wedding.appointment.controller.dto.CreateAppointmentRequest;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentRepository;
import com.bibbidi.wedding.auth.controller.dto.CreateUserRequest;
import com.bibbidi.wedding.auth.controller.dto.CreateUserResponse;
import com.bibbidi.wedding.auth.controller.dto.LoginRequest;
import com.bibbidi.wedding.catalog.CatalogTestFixture;
import com.bibbidi.wedding.catalog.CatalogTestFixture.CatalogData;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemRepository;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryRepository;
import com.bibbidi.wedding.catalog.persistence.JpaStepRepository;
import com.bibbidi.wedding.checklist.controller.dto.AddCatalogItemsRequest;
import com.bibbidi.wedding.checklist.controller.dto.AddCatalogItemsResponse;
import com.bibbidi.wedding.checklist.controller.dto.ChecklistCreationResponse;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import com.bibbidi.wedding.user.controller.dto.DeleteUserRequest;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.util.List;
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

    private HttpClient httpClient;
    private CatalogTestFixture catalogFixture;
    private CatalogData catalogData;

    @BeforeEach
    void setUp() {
        httpClient = HttpClient.newHttpClient();
        catalogFixture = new CatalogTestFixture(categoryRepository, stepRepository, catalogItemRepository);
        clearData();
        catalogData = catalogFixture.createWeddingHallCatalog();
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    @Test
    @DisplayName("회원 탈퇴는 현재 사용자의 결혼 준비 데이터만 삭제하고 준비 목록과 다른 사용자 데이터를 유지한다")
    void shouldDeleteOnlyCurrentUsersWeddingDataAndInvalidateSession() throws Exception {
        AuthenticatedUser currentUser = registerAndLogin("current");
        OwnedWeddingData currentUsersData = createWeddingData(currentUser.sessionCookie());
        AuthenticatedUser otherUser = registerAndLogin("other");
        OwnedWeddingData otherUsersData = createWeddingData(otherUser.sessionCookie());

        HttpResponse<String> deletionResponse = deleteCurrentUser(currentUser.sessionCookie());

        assertThat(deletionResponse.statusCode()).isEqualTo(204);
        assertThat(deletionResponse.body()).isEmpty();
        assertThat(deletionResponse.headers().firstValue(HttpHeaders.SET_COOKIE).orElseThrow())
                .contains("Max-Age=0");
        assertCurrentUsersDataDeleted(currentUser.id(), currentUsersData);
        assertOtherUsersDataRemains(otherUser.id(), otherUsersData);
        assertCatalogRemains();

        HttpResponse<String> previousSessionResponse = httpClient.send(
                request("/api/checklists", currentUser.sessionCookie())
                        .POST(HttpRequest.BodyPublishers.noBody())
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );

        assertThat(previousSessionResponse.statusCode()).isEqualTo(401);
        assertThat(previousSessionResponse.body())
                .contains("\"errorCode\":201")
                .contains("\"message\":\"로그인이 필요합니다.\"");
    }

    private AuthenticatedUser registerAndLogin(String nickname) throws Exception {
        HttpResponse<String> registrationResponse = sendJson(
                "/api/users",
                null,
                new CreateUserRequest(nickname, PASSWORD)
        );
        assertThat(registrationResponse.statusCode()).isEqualTo(201);
        CreateUserResponse user = objectMapper.readValue(registrationResponse.body(), CreateUserResponse.class);

        HttpResponse<String> loginResponse = sendJson(
                "/api/login",
                null,
                new LoginRequest(nickname, PASSWORD)
        );
        assertThat(loginResponse.statusCode()).isEqualTo(200);

        String setCookie = loginResponse.headers().firstValue(HttpHeaders.SET_COOKIE).orElseThrow();
        return new AuthenticatedUser(user.id(), setCookie.substring(0, setCookie.indexOf(';')));
    }

    private OwnedWeddingData createWeddingData(String sessionCookie) throws Exception {
        HttpResponse<String> checklistResponse = httpClient.send(
                request("/api/checklists", sessionCookie)
                        .POST(HttpRequest.BodyPublishers.noBody())
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
        assertThat(checklistResponse.statusCode()).isEqualTo(201);
        ChecklistCreationResponse checklist = objectMapper.readValue(
                checklistResponse.body(),
                ChecklistCreationResponse.class
        );

        HttpResponse<String> checklistItemResponse = sendJson(
                "/api/checklists/me/catalog-items",
                sessionCookie,
                new AddCatalogItemsRequest(List.of(catalogData.catalogItemId()))
        );
        assertThat(checklistItemResponse.statusCode()).isEqualTo(201);
        AddCatalogItemsResponse checklistItems = objectMapper.readValue(
                checklistItemResponse.body(),
                AddCatalogItemsResponse.class
        );
        AddCatalogItemsResponse.AddedChecklistItemResponse checklistItem = checklistItems.items().getFirst();
        assertThat(checklistItem.catalogItemId()).isEqualTo(catalogData.catalogItemId());

        HttpResponse<String> appointmentResponse = sendJson(
                "/api/checklist-items/" + checklistItem.id() + "/appointments",
                sessionCookie,
                new CreateAppointmentRequest(
                        "웨딩홀 상담",
                        LocalDate.of(2026, 9, 1),
                        null,
                        null,
                        null,
                        null
                )
        );
        assertThat(appointmentResponse.statusCode()).isEqualTo(201);
        AppointmentResponse appointment = objectMapper.readValue(appointmentResponse.body(), AppointmentResponse.class);

        return new OwnedWeddingData(checklist.id(), checklistItem.id(), appointment.id());
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

    private void assertOtherUsersDataRemains(Long userId, OwnedWeddingData data) {
        assertThat(userRepository.findById(userId)).isPresent();
        assertThat(checklistRepository.findById(data.checklistId())).isPresent();
        assertThat(checklistItemRepository.findById(data.checklistItemId())).isPresent();
        assertThat(appointmentRepository.findById(data.appointmentId())).isPresent();
    }

    private void assertCatalogRemains() {
        assertThat(categoryRepository.findById(catalogData.categoryId())).isPresent();
        assertThat(stepRepository.findById(catalogData.stepId())).isPresent();
        assertThat(catalogItemRepository.findById(catalogData.catalogItemId())).isPresent();
    }

    private void clearData() {
        appointmentRepository.deleteAllInBatch();
        checklistItemRepository.deleteAllInBatch();
        checklistRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();
        if (catalogFixture != null) {
            catalogFixture.clear();
        }
    }

    private record AuthenticatedUser(
            Long id,
            String sessionCookie
    ) {
    }

    private record OwnedWeddingData(
            Long checklistId,
            Long checklistItemId,
            Long appointmentId
    ) {
    }
}
