package com.bibbidi.wedding.checklist.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.token.BibbidiTokenIssuer;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.support.AuthenticationTestSupport;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.SqlMergeMode;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@SqlMergeMode(SqlMergeMode.MergeMode.MERGE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Sql("/fixtures/checklist-catalog-fixture.sql")
@Sql(scripts = "/fixtures/checklist-catalog-cleanup.sql", executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class CatalogItemAdditionIntegrationTest extends BibbidiIntegrationTest {

    @Autowired
    private BibbidiTokenIssuer tokenIssuer;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ChecklistService checklistService;

    @Test
    @DisplayName("요청 중복은 한 번만 담고 요청 순서와 무관하게 카탈로그 표시 순서와 응답 필드를 유지한다")
    void shouldDeduplicateAndKeepCatalogOrder() throws Exception {
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .header(AUTHORIZATION, token(7L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(101L, 100L, 101L))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items[*].catalogItemId", contains(100, 101)))
                .andExpect(jsonPath("$.items[0].id").isNumber())
                .andExpect(jsonPath("$.items[0].categoryId").value(2))
                .andExpect(jsonPath("$.items[0].title").value("계약서 확인"))
                .andExpect(jsonPath("$.items[0].status").value("prev"));
    }

    @Test
    @DisplayName("없는 ID가 섞이면 기존 오류를 내며 유효한 항목도 저장하지 않는다")
    void shouldRejectMissingIdWithoutPartialSave() throws Exception {
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .header(AUTHORIZATION, token(7L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(100L, 999L))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."));
        assertOwnCatalogItems(7L, List.of());
    }

    @Test
    @DisplayName("새 항목 INSERT 뒤 기존 항목의 중복이 발생해도 요청 전체를 롤백한다")
    void shouldRollbackWhenAlreadyAddedItemIsMixed() throws Exception {
        add(7L, 101L);
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .header(AUTHORIZATION, token(7L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(100L, 101L))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value(403));
        assertOwnCatalogItems(7L, List.of(101));
    }

    @Test
    @Sql(statements = "INSERT INTO users (id, nickname, status, role, created_at, updated_at) VALUES (8, 'other', 'ACTIVE', 'NORMAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
    @DisplayName("각 사용자의 체크리스트에만 담으며 다른 사용자의 등록 여부는 영향을 주지 않는다")
    void shouldAddOnlyToAuthenticatedOwnersChecklist() throws Exception {
        mockMvc.perform(post("/api/checklists").header(AUTHORIZATION, token(8L)))
                .andExpect(status().isCreated());
        add(7L, 100L);
        assertOwnCatalogItems(8L, List.of());
        add(8L, 100L);
        assertOwnCatalogItems(7L, List.of(100));
        assertOwnCatalogItems(8L, List.of(100));
    }

    @Test
    @DisplayName("실제 카탈로그 조회를 공유하는 추천 검증은 없는 ID와 등록 항목과 중복을 제외하고 요청 순서를 유지한다")
    void shouldKeepRecommendationValidationContract() throws Exception {
        add(7L, 100L);
        assertThat(checklistService.filterRecommendableCatalogItemIds(7L, List.of(999L, 101L, 100L, 101L)))
                .containsExactly(101L);
        assertThat(checklistService.filterRecommendableCatalogItemIds(7L, List.of())).isEmpty();
    }

    private void add(Long userId, Long catalogItemId) throws Exception {
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .header(AUTHORIZATION, token(userId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(catalogItemId))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items[*].catalogItemId", contains(catalogItemId.intValue())));
    }

    private void assertOwnCatalogItems(Long userId, List<Integer> ids) throws Exception {
        String response = mockMvc.perform(get("/api/checklists/me").header(AUTHORIZATION, token(userId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Integer> actual = objectMapper.readTree(response).get("items").valueStream()
                .map(item -> item.get("sourceCatalogItemId").asInt())
                .toList();
        assertThat(actual).containsExactlyInAnyOrderElementsOf(ids);
    }

    private String token(Long userId) {
        return AuthenticationTestSupport.bearerTokenOf(tokenIssuer, userId, "테스트회원");
    }
}
