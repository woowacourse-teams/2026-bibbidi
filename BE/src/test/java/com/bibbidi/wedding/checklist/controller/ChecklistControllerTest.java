package com.bibbidi.wedding.checklist.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.config.AuthWebConfig;
import com.bibbidi.wedding.auth.session.AuthArgumentResolver;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.auth.session.SessionUserIdProvider;
import com.bibbidi.wedding.checklist.controller.dto.AddCatalogItemsRequest;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.service.dto.CatalogItemAdditionResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(ChecklistController.class)
@Import({AuthWebConfig.class, AuthArgumentResolver.class, SessionUserIdProvider.class})
class ChecklistControllerTest {

    private static final Long USER_ID = 7L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ChecklistService checklistService;

    private static MockHttpSession authenticatedSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, USER_ID);
        return session;
    }

    @Test
    @DisplayName("인증된 사용자의 요청에 생성된 체크리스트 식별자를 응답한다")
    void shouldRespondCreatedChecklistId() throws Exception {
        // given
        when(checklistService.create(USER_ID)).thenReturn(new ChecklistCreationResult(10L));

        // when, then
        mockMvc.perform(post("/api/checklists").session(authenticatedSession()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10));
    }

    @Test
    @DisplayName("이미 체크리스트를 가진 사용자의 생성 요청을 중복 오류로 응답한다")
    void shouldRespondConflictWhenChecklistAlreadyExists() throws Exception {
        // given
        when(checklistService.create(USER_ID)).thenThrow(new BusinessException(
                ClientError.DUPLICATE_CHECKLIST,
                "체크리스트 중복 생성에 실패했습니다. ownerId=" + USER_ID
        ));

        // when, then
        mockMvc.perform(post("/api/checklists").session(authenticatedSession()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value(402))
                .andExpect(jsonPath("$.message").value("이미 체크리스트가 존재합니다."));
    }

    @Test
    @DisplayName("인증되지 않은 사용자의 체크리스트 생성 요청을 거부한다")
    void shouldRejectRequestWhenUnauthenticated() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."));
    }

    @Test
    @DisplayName("선택한 준비 항목을 할 일로 추가하고 생성 결과를 응답한다")
    void shouldRespondAddedChecklistItems() throws Exception {
        // given
        when(checklistService.addItemsFromCatalog(USER_ID, List.of(100L, 101L)))
                .thenReturn(new CatalogItemAdditionResult(List.of(
                        new CatalogItemAdditionResult.AddedChecklistItem(201L, 100L, 2L, "계약서 확인", ChecklistItemStatus.PREV),
                        new CatalogItemAdditionResult.AddedChecklistItem(202L, 101L, 2L, "견적 비교", ChecklistItemStatus.PREV)
                )));

        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddCatalogItemsRequest(List.of(100L, 101L)))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items[0].id").value(201))
                .andExpect(jsonPath("$.items[0].catalogItemId").value(100))
                .andExpect(jsonPath("$.items[0].categoryId").value(2))
                .andExpect(jsonPath("$.items[0].title").value("계약서 확인"))
                .andExpect(jsonPath("$.items[0].status").value("prev"))
                .andExpect(jsonPath("$.items[1].catalogItemId").value(101));
    }

    @Test
    @DisplayName("추가할 준비 항목이 비어 있으면 요청을 거절한다")
    void shouldRejectEmptyCatalogItemIds() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddCatalogItemsRequest(List.of()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101));
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자의 추가 요청을 거절한다")
    void shouldRespondNotFoundWhenChecklistDoesNotExist() throws Exception {
        // given
        when(checklistService.addItemsFromCatalog(USER_ID, List.of(100L)))
                .thenThrow(new BusinessException(ClientError.CHECKLIST_NOT_FOUND, "체크리스트가 없습니다."));

        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddCatalogItemsRequest(List.of(100L)))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value(303))
                .andExpect(jsonPath("$.message").value("체크리스트를 찾을 수 없습니다."));
    }

    @Test
    @DisplayName("이미 추가된 준비 항목이 포함되면 요청을 거절한다")
    void shouldRespondConflictWhenCatalogItemAlreadyAdded() throws Exception {
        // given
        when(checklistService.addItemsFromCatalog(USER_ID, List.of(100L)))
                .thenThrow(new BusinessException(ClientError.DUPLICATE_CHECKLIST_ITEM, "이미 추가된 항목입니다."));

        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddCatalogItemsRequest(List.of(100L)))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value(403))
                .andExpect(jsonPath("$.message").value("이미 추가된 준비 항목입니다."));
    }

    @Test
    @DisplayName("준비 목록에 없는 항목이 포함되면 요청을 거절한다")
    void shouldRespondNotFoundWhenCatalogItemDoesNotExist() throws Exception {
        // given
        when(checklistService.addItemsFromCatalog(USER_ID, List.of(999L)))
                .thenThrow(new BusinessException(ClientError.INVALID_REQUEST, "준비 목록에 없는 항목이 포함되었습니다."));

        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .session(authenticatedSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddCatalogItemsRequest(List.of(999L)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."));
    }

    @Test
    @DisplayName("인증되지 않은 사용자의 준비 항목 추가 요청을 거부한다")
    void shouldRejectAddRequestWhenUnauthenticated() throws Exception {
        // when, then
        mockMvc.perform(post("/api/checklists/me/catalog-items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddCatalogItemsRequest(List.of(100L)))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201));
    }
}
