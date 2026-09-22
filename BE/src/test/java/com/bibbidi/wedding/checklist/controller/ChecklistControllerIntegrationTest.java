package com.bibbidi.wedding.checklist.controller;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.parameterWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.checklist.controller.dto.req.CreateAppointmentRequest;
import com.bibbidi.wedding.checklist.controller.dto.req.CreateChecklistItemRequest;
import com.bibbidi.wedding.auth.token.AccessTokenIssuer;
import com.bibbidi.wedding.support.AuthenticationTestSupport;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import tools.jackson.databind.ObjectMapper;

@Sql("/checklist-fixture.sql")
class ChecklistControllerIntegrationTest extends BibbidiIntegrationTest {

    @Autowired
    private AccessTokenIssuer accessTokenIssuer;

    private String bearerToken(Long userId) {
        return AuthenticationTestSupport.bearerTokenOf(accessTokenIssuer, userId, "테스트회원");
    }

    private static final Long USER_ID = 7L;
    private static final String CREATE_SUMMARY = "빈 체크리스트 생성";
    private static final String CREATE_DESCRIPTION =
            "access token의 사용자 ID를 소유자로 사용해 할 일이 없는 체크리스트를 생성합니다.";
    private static final String SESSION_COOKIE_DESCRIPTION =
            "로그인 시 발급된 access token";
    private static final String WRITE_SUMMARY = "직접 할 일 생성";
    private static final String WRITE_DESCRIPTION =
            "준비 목록에 없는 할 일을 제목과 카테고리만으로 현재 사용자의 체크리스트에 추가합니다. "
                    + "원본 준비 항목이 없으므로 제목이 같은 할 일도 여러 번 추가할 수 있습니다.";
    private static final String ADD_SUMMARY = "준비 목록의 항목을 체크리스트에 추가";
    private static final String ADD_DESCRIPTION =
            "선택한 준비 항목의 제목과 카테고리를 복사해 현재 사용자의 체크리스트에 할 일로 추가합니다. "
                    + "이미 담긴 준비 항목이 포함되면 요청 전체가 실패합니다.";
    private static final String FIND_UNSCHEDULED_SUMMARY = "일정이 필요한 할 일 조회";
    private static final String FIND_UNSCHEDULED_DESCRIPTION =
            "완료되지 않았고 연결된 일정이 하나도 없는 현재 사용자의 할 일을 랜덤으로 최대 limit개 조회합니다. "
                    + "준비 목록에서 담은 할 일과 직접 만든 할 일을 모두 포함하며, 대상이 없으면 빈 배열을 반환합니다.";
    private static final String FIND_RECOMMENDED_SUMMARY = "추가하면 좋은 할 일 조회";
    private static final String FIND_RECOMMENDED_DESCRIPTION =
            "현재 사용자가 준비 목록에서 담은 항목 중 가장 높은 단계까지, 아직 담지 않은 준비 항목을 랜덤으로 최대 limit개 조회합니다. "
                    + "담은 항목이 없으면 1단계를, 그 단계까지 모두 담았으면 담지 않은 항목이 남은 가장 이른 단계를 추천하며, "
                    + "준비 항목을 모두 담았으면 빈 배열을 반환합니다.";

    @Autowired
    private ObjectMapper objectMapper;



    @Test
    @DisplayName("인증된 사용자는 자신이 소유한 빈 체크리스트를 생성한다")
    void shouldCreateEmptyChecklistForAuthenticatedUser() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists")
                        .header(AUTHORIZATION, bearerToken(USER_ID)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$").isNumber())
                .andDo(document(
                                "checklists-create",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(CREATE_SUMMARY)
                                        .description(CREATE_DESCRIPTION + " 생성된 체크리스트 ID를 그대로 응답 본문으로 반환합니다.")
                                        .requestHeaders(
                                                headerWithName(HttpHeaders.AUTHORIZATION)
                                                        .description(SESSION_COOKIE_DESCRIPTION)
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @Sql("/appointment-fixture.sql")
    @Sql(statements = "INSERT INTO checklist_items (id, checklist_id, category_id, source_catalog_item_id, title, status, created_at, updated_at) VALUES (2, 1, 1, NULL, '청첩장 제작', 'CONTINUE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), (3, 1, 1, NULL, '피팅 예약', 'DONE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
    @Sql(statements = "INSERT INTO appointments (id, checklist_item_id, title, appointment_date, start_time, end_time, place, memo, is_done, done_by_checklist_item, created_at, updated_at) VALUES (100, 1, 'appointment', '2026-09-10', '2026-09-10 10:00:00', '2026-09-10 11:00:00', 'place', 'memo', FALSE, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
    @DisplayName("로그인한 사용자의 할 일을 상태와 일정과 함께 조회한다")
    void shouldReturnChecklistItemsWithAppointments() throws Exception {

        mockMvc.perform(get("/api/checklists/me")
                        .header(AUTHORIZATION, bearerToken(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.items[0].id").value(1))
                .andExpect(jsonPath("$.items[0].categoryId").value(1))
                .andExpect(jsonPath("$.items[0].sourceCatalogItemId").isEmpty())
                .andExpect(jsonPath("$.items[0].status").value("prev"))
                .andExpect(jsonPath("$.items[0].appointments[0].title").value("appointment"))
                .andExpect(jsonPath("$.items[0].appointments[0].date").value("2026-09-10"))
                .andExpect(jsonPath("$.items[0].appointments[0].startTime").value("2026-09-10T10:00:00"))
                .andExpect(jsonPath("$.items[0].appointments[0].place").value("place"))
                .andExpect(jsonPath("$.items[0].appointments[0].memo").value("memo"))
                .andExpect(jsonPath("$.items[0].appointments[0].isDone").value(false))
                .andExpect(jsonPath("$.items[1].id").value(2))
                .andExpect(jsonPath("$.items[1].title").value("청첩장 제작"))
                .andExpect(jsonPath("$.items[1].status").value("continue"))
                .andExpect(jsonPath("$.items[1].appointments").isEmpty())
                .andExpect(jsonPath("$.items[2].id").value(3))
                .andExpect(jsonPath("$.items[2].title").value("피팅 예약"))
                .andExpect(jsonPath("$.items[2].status").value("done"))
                .andDo(document(
                                "checklists-find-me",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary("내 체크리스트 조회")
                                        .description("현재 사용자의 모든 할 일과 각 할 일에 연결된 일정을 조회합니다.")
                                        .responseSchema(schema("ChecklistWithAppointmentsResponse"))
                                        .requestHeaders(
                                                headerWithName(HttpHeaders.AUTHORIZATION)
                                                        .description(SESSION_COOKIE_DESCRIPTION)
                                        )
                                        .responseFields(
                                                fieldWithPath("id").description("체크리스트 ID"),
                                                fieldWithPath("items[].id").description("할 일 ID"),
                                                fieldWithPath("items[].categoryId").description("카테고리 ID"),
                                                fieldWithPath("items[].sourceCatalogItemId").description("원본 준비 항목 ID")
                                                        .optional(),
                                                fieldWithPath("items[].title").description("할 일 제목"),
                                                fieldWithPath("items[].status").description("할 일 상태. prev, continue, done"),
                                                fieldWithPath("items[].appointments").description("할 일에 연결된 일정 목록"),
                                                fieldWithPath("items[].appointments[].id").description("일정 ID"),
                                                fieldWithPath("items[].appointments[].title").description("일정 제목"),
                                                fieldWithPath("items[].appointments[].date").description("일정 날짜"),
                                                fieldWithPath("items[].appointments[].startTime").description("일정 시작 시간")
                                                        .optional(),
                                                fieldWithPath("items[].appointments[].endTime").description("일정 종료 시간")
                                                        .optional(),
                                                fieldWithPath("items[].appointments[].place").description("일정 장소").optional(),
                                                fieldWithPath("items[].appointments[].memo").description("일정 메모").optional(),
                                                fieldWithPath("items[].appointments[].isDone").description("일정 완료 여부")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @DisplayName("인증되지 않은 사용자의 체크리스트 조회 요청을 거절한다")
    void shouldRequireAuthenticationToFindChecklist() throws Exception {
        mockMvc.perform(get("/api/checklists/me"))
                .andExpect(status().isUnauthorized())
                .andDo(document(
                                "checklists-find-me-unauthorized",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary("인증 없이 내 체크리스트 조회")
                                        .description("인증되지 않은 사용자의 체크리스트 조회 요청은 거절합니다.")
                                        .responseSchema(schema("ErrorResponse"))
                                        .responseFields(
                                                fieldWithPath("errorCode").description("오류 코드"),
                                                fieldWithPath("message").description("오류 메시지")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자의 조회 요청을 거절한다")
    void shouldRejectWhenChecklistDoesNotExist() throws Exception {
        mockMvc.perform(get("/api/checklists/me")
                        .header(AUTHORIZATION, bearerToken(USER_ID)))
                .andExpect(status().isNotFound())
                .andDo(document(
                                "checklists-find-me-not-found",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary("체크리스트가 없는 사용자의 조회")
                                        .description("현재 사용자에게 체크리스트가 없으면 조회 요청을 거절합니다.")
                                        .responseSchema(schema("ErrorResponse"))
                                        .responseFields(
                                                fieldWithPath("errorCode").description("오류 코드"),
                                                fieldWithPath("message").description("오류 메시지")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @DisplayName("빈 체크리스트의 진행도는 0%이며 전체 완료 상태가 아니다")
    void shouldReturnZeroProgressForEmptyChecklist() throws Exception {
        mockMvc.perform(post("/api/checklists")
                        .header(AUTHORIZATION, bearerToken(USER_ID)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/checklists/me/progress")
                        .header(AUTHORIZATION, bearerToken(USER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(0))
                .andExpect(jsonPath("$.doneCount").value(0))
                .andExpect(jsonPath("$.remainingCount").value(0))
                .andExpect(jsonPath("$.percentage").value(0))
                .andExpect(jsonPath("$.allDone").value(false));
    }

    @Test
    @DisplayName("인증되지 않은 사용자의 진행도 조회 요청을 거절한다")
    void shouldRequireAuthenticationToFindChecklistProgress() throws Exception {
        mockMvc.perform(get("/api/checklists/me/progress"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("일정이 없는 할 일을 준비 목록에서 담은 할 일과 직접 만든 할 일 구분 없이 조회한다")
    void shouldFindUnscheduledItems() throws Exception {
        // given
        long catalogSourcedItemId = addCatalogItem(100L);
        long scheduledItemId = addCatalogItem(101L);
        long customItemId = writeCustomItem("청첩장 문구 정하기");
        addAppointment(scheduledItemId);

        // when, then
        mockMvc.perform(get("/api/checklists/me/unscheduled-items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .param("limit", "4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[*].checklistItemId",
                        containsInAnyOrder((int) catalogSourcedItemId, (int) customItemId)))
                .andExpect(jsonPath("$[*].categoryName", everyItem(is("웨딩홀"))))
                .andExpect(jsonPath("$[*].status", everyItem(is("prev"))))
                .andDo(document(
                                "checklists-find-unscheduled-items",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(FIND_UNSCHEDULED_SUMMARY)
                                        .description(FIND_UNSCHEDULED_DESCRIPTION)
                                        .responseSchema(schema("UnscheduledChecklistItemResponse"))
                                        .requestHeaders(
                                                headerWithName(HttpHeaders.AUTHORIZATION)
                                                        .description(SESSION_COOKIE_DESCRIPTION)
                                        )
                                        .queryParameters(
                                                parameterWithName("limit")
                                                        .description("조회할 최대 개수 (기본값 4, 최대 20)")
                                                        .optional()
                                        )
                                        .responseFields(
                                                fieldWithPath("[].checklistItemId")
                                                        .description("할 일 ID. 일정 추가 API의 checklistItemId로 그대로 사용"),
                                                fieldWithPath("[].title").description("할 일 제목"),
                                                fieldWithPath("[].categoryName").description("할 일이 속한 카테고리 이름"),
                                                fieldWithPath("[].status").description("할 일 상태. prev, continue")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("일정이 필요한 할 일을 limit 개수만큼만 조회한다")
    void shouldFindUnscheduledItemsUpToLimit() throws Exception {
        // given
        addCatalogItem(100L);
        addCatalogItem(101L);
        writeCustomItem("청첩장 문구 정하기");

        // when, then
        mockMvc.perform(get("/api/checklists/me/unscheduled-items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .param("limit", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    @DisplayName("인증되지 않은 사용자의 일정이 필요한 할 일 조회 요청을 거절한다")
    void shouldRequireAuthenticationToFindUnscheduledItems() throws Exception {
        mockMvc.perform(get("/api/checklists/me/unscheduled-items"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andDo(document(
                                "checklists-find-unscheduled-items-unauthorized",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(FIND_UNSCHEDULED_SUMMARY)
                                        .description("인증되지 않은 사용자의 일정이 필요한 할 일 조회 요청은 거절합니다.")
                                        .responseSchema(schema("ErrorResponse"))
                                        .responseFields(
                                                fieldWithPath("errorCode").description("오류 코드"),
                                                fieldWithPath("message").description("오류 메시지")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자의 일정이 필요한 할 일 조회 요청을 거절한다")
    void shouldRejectFindUnscheduledItemsWhenChecklistDoesNotExist() throws Exception {
        mockMvc.perform(get("/api/checklists/me/unscheduled-items")
                        .header(AUTHORIZATION, bearerToken(USER_ID)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(303))
                .andDo(document(
                                "checklists-find-unscheduled-items-not-found",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(FIND_UNSCHEDULED_SUMMARY)
                                        .description("현재 사용자에게 체크리스트가 없으면 조회 요청을 거절합니다.")
                                        .responseSchema(schema("ErrorResponse"))
                                        .requestHeaders(
                                                headerWithName(HttpHeaders.AUTHORIZATION)
                                                        .description(SESSION_COOKIE_DESCRIPTION)
                                        )
                                        .responseFields(
                                                fieldWithPath("errorCode").description("오류 코드"),
                                                fieldWithPath("message").description("오류 메시지")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @Sql("/checklist-recommendation-fixture.sql")
    @DisplayName("담은 준비 항목의 가장 높은 단계까지 아직 담지 않은 준비 항목을 추천한다")
    void shouldFindRecommendedCatalogItems() throws Exception {
        // given
        addCatalogItem(101L);

        // when, then
        mockMvc.perform(get("/api/checklists/me/recommended-catalog-items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .param("limit", "4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[*].catalogItemId", containsInAnyOrder(100, 200, 201)))
                .andDo(document(
                                "checklists-find-recommended-catalog-items",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(FIND_RECOMMENDED_SUMMARY)
                                        .description(FIND_RECOMMENDED_DESCRIPTION)
                                        .responseSchema(schema("RecommendedCatalogItemResponse"))
                                        .requestHeaders(
                                                headerWithName(HttpHeaders.AUTHORIZATION)
                                                        .description(SESSION_COOKIE_DESCRIPTION)
                                        )
                                        .queryParameters(
                                                parameterWithName("limit")
                                                        .description("조회할 최대 개수 (기본값 4, 최대 20)")
                                                        .optional()
                                        )
                                        .responseFields(
                                                fieldWithPath("[].catalogItemId")
                                                        .description("준비 항목 ID. 내 할 일에 추가 API의 catalogItemIds로 그대로 사용"),
                                                fieldWithPath("[].title").description("준비 항목 제목"),
                                                fieldWithPath("[].categoryName").description("준비 항목이 속한 카테고리 이름"),
                                                fieldWithPath("[].phase").description("준비 항목이 속한 단계 번호"),
                                                fieldWithPath("[].stepName").description("준비 항목이 속한 단계 이름")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @DisplayName("인증되지 않은 사용자의 추가하면 좋은 할 일 조회 요청을 거절한다")
    void shouldRequireAuthenticationToFindRecommendedCatalogItems() throws Exception {
        mockMvc.perform(get("/api/checklists/me/recommended-catalog-items"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andDo(document(
                                "checklists-find-recommended-catalog-items-unauthorized",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(FIND_RECOMMENDED_SUMMARY)
                                        .description("인증되지 않은 사용자의 추가하면 좋은 할 일 조회 요청은 거절합니다.")
                                        .responseSchema(schema("ErrorResponse"))
                                        .responseFields(
                                                fieldWithPath("errorCode").description("오류 코드"),
                                                fieldWithPath("message").description("오류 메시지")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자의 추가하면 좋은 할 일 조회 요청을 거절한다")
    void shouldRejectFindRecommendedCatalogItemsWhenChecklistDoesNotExist() throws Exception {
        mockMvc.perform(get("/api/checklists/me/recommended-catalog-items")
                        .header(AUTHORIZATION, bearerToken(USER_ID)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(303))
                .andDo(document(
                                "checklists-find-recommended-catalog-items-not-found",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(FIND_RECOMMENDED_SUMMARY)
                                        .description("현재 사용자에게 체크리스트가 없으면 조회 요청을 거절합니다.")
                                        .responseSchema(schema("ErrorResponse"))
                                        .requestHeaders(
                                                headerWithName(HttpHeaders.AUTHORIZATION)
                                                        .description(SESSION_COOKIE_DESCRIPTION)
                                        )
                                        .responseFields(
                                                fieldWithPath("errorCode").description("오류 코드"),
                                                fieldWithPath("message").description("오류 메시지")
                                        )
                                        .build()
                                )
                        )
                );
    }

    private long addCatalogItem(Long catalogItemId) throws Exception {
        String response = mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(catalogItemId))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("items").get(0).get("id").asLong();
    }

    private long writeCustomItem(String title) throws Exception {
        String response = mockMvc.perform(post("/api/checklists/me/items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateChecklistItemRequest(title, 2L))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private void addAppointment(long checklistItemId) throws Exception {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                "웨딩홀 투어",
                LocalDate.of(2026, 10, 1),
                null,
                null,
                null,
                null
        );
        mockMvc.perform(post("/api/checklist-items/{checklistItemId}/appointments", checklistItemId)
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("이미 체크리스트를 가진 사용자의 생성 요청은 거절하고 사용자 계정은 유지한다")
    void shouldRejectDuplicateChecklistAndKeepUser() throws Exception {
        // given
        String token = bearerToken(USER_ID);
        mockMvc.perform(post("/api/checklists")
                        .header(AUTHORIZATION, token))
                .andExpect(status().isCreated());

        // when, then
        mockMvc.perform(post("/api/checklists")
                        .header(AUTHORIZATION, token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value(402))
                .andExpect(jsonPath("$.message").value("이미 체크리스트가 존재합니다."))
                .andDo(document(
                                "checklists-create-conflict",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(CREATE_SUMMARY)
                                        .description(CREATE_DESCRIPTION)
                                        .responseSchema(schema("ErrorResponse"))
                                        .requestHeaders(
                                                headerWithName(HttpHeaders.AUTHORIZATION)
                                                        .description(SESSION_COOKIE_DESCRIPTION)
                                        )
                                        .responseFields(
                                                fieldWithPath("errorCode").description("오류 코드"),
                                                fieldWithPath("message").description("오류 메시지")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @DisplayName("access token이 없으면 체크리스트를 생성할 수 없다")
    void shouldRequireAuthenticationToCreateChecklist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."))
                .andDo(document(
                                "checklists-create-authentication-required",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(CREATE_SUMMARY)
                                        .description(CREATE_DESCRIPTION)
                                        .responseSchema(schema("ErrorResponse"))
                                        .responseFields(
                                                fieldWithPath("errorCode").description("오류 코드"),
                                                fieldWithPath("message").description("오류 메시지")
                                        )
                                        .build())
                        )
                );
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("선택한 준비 항목을 자신의 체크리스트에 할 일로 추가한다")
    void shouldAddSelectedCatalogItemsToOwnChecklist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(100L, 101L))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items[0].catalogItemId").value(100))
                .andExpect(jsonPath("$.items[0].categoryId").value(2))
                .andExpect(jsonPath("$.items[0].title").value("계약서 확인"))
                .andExpect(jsonPath("$.items[0].status").value("prev"))
                .andDo(document(
                                "checklists-add-catalog-items",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(ADD_SUMMARY)
                                        .description(ADD_DESCRIPTION)
                                        .responseSchema(schema("AddCatalogItemsResponse"))
                                        .requestHeaders(
                                                headerWithName(HttpHeaders.AUTHORIZATION)
                                                        .description(SESSION_COOKIE_DESCRIPTION)
                                        )
                                        .requestFields(
                                                fieldWithPath("[]").description("추가할 준비 항목 ID 목록")
                                        )
                                        .responseFields(
                                                fieldWithPath("items[].id").description("생성된 할 일 ID"),
                                                fieldWithPath("items[].catalogItemId").description("원본 준비 항목 ID"),
                                                fieldWithPath("items[].categoryId").description("복사된 카테고리 ID"),
                                                fieldWithPath("items[].title").description("복사된 할 일 제목"),
                                                fieldWithPath("items[].status").description("할 일 상태. prev, continue, done")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("이미 담은 준비 항목이 포함되면 요청 전체를 거절한다")
    void shouldRejectWhenCatalogItemAlreadyAdded() throws Exception {
        // given
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(100L))))
                .andExpect(status().isCreated());

        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(100L, 101L))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value(403))
                .andExpect(jsonPath("$.message").value("이미 추가된 준비 항목입니다."))
                .andDo(document(
                                "checklists-add-catalog-items-conflict",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(ADD_SUMMARY)
                                        .description(ADD_DESCRIPTION)
                                        .responseSchema(schema("ErrorResponse"))
                                        .requestHeaders(
                                                headerWithName(HttpHeaders.AUTHORIZATION)
                                                        .description(SESSION_COOKIE_DESCRIPTION)
                                        )
                                        .requestFields(
                                                fieldWithPath("[]").description("추가할 준비 항목 ID 목록")
                                        )
                                        .responseFields(
                                                fieldWithPath("errorCode").description("오류 코드"),
                                                fieldWithPath("message").description("오류 메시지")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("준비 목록에 없는 항목이 포함되면 요청 전체를 거절한다")
    void shouldRejectWhenCatalogItemDoesNotExist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(100L, 999L))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."));
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자는 준비 항목을 추가할 수 없다")
    void shouldRejectAddWhenChecklistDoesNotExist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(100L))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(303))
                .andExpect(jsonPath("$.message").value("체크리스트를 찾을 수 없습니다."))
                .andDo(document(
                                "checklists-add-catalog-items-checklist-not-found",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(ADD_SUMMARY)
                                        .description(ADD_DESCRIPTION)
                                        .responseSchema(schema("ErrorResponse"))
                                        .requestHeaders(
                                                headerWithName(HttpHeaders.AUTHORIZATION)
                                                        .description(SESSION_COOKIE_DESCRIPTION)
                                        )
                                        .requestFields(
                                                fieldWithPath("[]").description("추가할 준비 항목 ID 목록")
                                        )
                                        .responseFields(
                                                fieldWithPath("errorCode").description("오류 코드"),
                                                fieldWithPath("message").description("오류 메시지")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("준비 목록에 없는 할 일을 자신의 체크리스트에 직접 추가한다")
    void shouldWriteCustomItemToOwnChecklist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("청첩장 문구 정하기", 2L))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.catalogItemId").value(nullValue()))
                .andExpect(jsonPath("$.categoryId").value(2))
                .andExpect(jsonPath("$.title").value("청첩장 문구 정하기"))
                .andExpect(jsonPath("$.status").value("prev"))
                .andDo(document(
                                "checklists-write-item",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(WRITE_SUMMARY)
                                        .description(WRITE_DESCRIPTION)
                                        .requestSchema(schema("CreateChecklistItemRequest"))
                                        .responseSchema(schema("ChecklistItemResponse"))
                                        .requestHeaders(
                                                headerWithName(HttpHeaders.AUTHORIZATION)
                                                        .description(SESSION_COOKIE_DESCRIPTION)
                                        )
                                        .requestFields(
                                                fieldWithPath("title").description("할 일 제목. 앞뒤 공백을 제거한 뒤 1자 이상 50자 이하"),
                                                fieldWithPath("categoryId").description("할 일이 속할 카테고리 ID")
                                        )
                                        .responseFields(
                                                fieldWithPath("id").description("생성된 할 일 ID"),
                                                fieldWithPath("catalogItemId").description("원본 준비 항목 ID. 직접 만든 할 일은 항상 null"),
                                                fieldWithPath("categoryId").description("할 일이 속한 카테고리 ID"),
                                                fieldWithPath("title").description("할 일 제목"),
                                                fieldWithPath("status").description("할 일 상태. prev, continue, done")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("직접 만든 할 일은 제목이 같아도 여러 번 추가할 수 있다")
    void shouldAllowDuplicateTitleForCustomItems() throws Exception {
        // given
        mockMvc.perform(post("/api/checklists/me/items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("청첩장 문구 정하기", 2L))))
                .andExpect(status().isCreated());

        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("청첩장 문구 정하기", 2L))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("청첩장 문구 정하기"));
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("준비 목록에 없는 카테고리로는 직접 할 일을 만들 수 없다")
    void shouldRejectWriteWhenCategoryDoesNotExist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("청첩장 문구 정하기", 999L))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(305))
                .andExpect(jsonPath("$.message").value("카테고리를 찾을 수 없습니다."))
                .andDo(document(
                                "checklists-write-item-category-not-found",
                                resource(ResourceSnippetParameters.builder()
                                        .tag("Checklist")
                                        .summary(WRITE_SUMMARY)
                                        .description(WRITE_DESCRIPTION)
                                        .responseSchema(schema("ErrorResponse"))
                                        .requestHeaders(
                                                headerWithName(HttpHeaders.AUTHORIZATION)
                                                        .description(SESSION_COOKIE_DESCRIPTION)
                                        )
                                        .requestFields(
                                                fieldWithPath("title").description("할 일 제목"),
                                                fieldWithPath("categoryId").description("할 일이 속할 카테고리 ID")
                                        )
                                        .responseFields(
                                                fieldWithPath("errorCode").description("오류 코드"),
                                                fieldWithPath("message").description("오류 메시지")
                                        )
                                        .build()
                                )
                        )
                );
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("공백만 있는 제목은 저장하지 않는다")
    void shouldRejectBlankTitle() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("   ", 2L))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."));
    }

    @Test
    @Sql("/checklist-catalog-fixture.sql")
    @DisplayName("50자를 넘는 제목은 저장하지 않는다")
    void shouldRejectTooLongTitle() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("가".repeat(51), 2L))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101));
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자는 직접 할 일을 만들 수 없다")
    void shouldRejectWriteWhenChecklistDoesNotExist() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .header(AUTHORIZATION, bearerToken(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("청첩장 문구 정하기", 2L))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(303))
                .andExpect(jsonPath("$.message").value("체크리스트를 찾을 수 없습니다."));
    }

    @Test
    @DisplayName("access token이 없으면 직접 할 일을 만들 수 없다")
    void shouldRequireAuthenticationToWriteItem() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateChecklistItemRequest("청첩장 문구 정하기", 2L))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."));
    }
}
