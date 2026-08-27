package com.bibbidi.wedding.checklist.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.config.AuthWebConfig;
import com.bibbidi.wedding.auth.session.AuthArgumentResolver;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.auth.session.SessionUserIdProvider;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ChecklistController.class)
@Import({AuthWebConfig.class, AuthArgumentResolver.class, SessionUserIdProvider.class})
class ChecklistControllerTest {

    private static final Long USER_ID = 7L;

    @Autowired
    private MockMvc mockMvc;

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
}
