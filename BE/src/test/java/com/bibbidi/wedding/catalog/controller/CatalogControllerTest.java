package com.bibbidi.wedding.catalog.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.config.AuthWebConfig;
import com.bibbidi.wedding.auth.session.AuthArgumentResolver;
import com.bibbidi.wedding.auth.session.AuthSession;
import com.bibbidi.wedding.auth.session.SessionUserIdProvider;
import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.domain.Category;
import com.bibbidi.wedding.catalog.domain.Item;
import com.bibbidi.wedding.catalog.domain.Step;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogQueryResult;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(CatalogController.class)
@Import({AuthWebConfig.class, AuthArgumentResolver.class, SessionUserIdProvider.class})
class CatalogControllerTest {

    private static final Long USER_ID = 7L;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CatalogService catalogService;

    private static CatalogQueryResult constructTestResult() {
        Item item = new Item(100L, "계약서 확인", 1, true);
        Step step = new Step(10L, "웨딩홀 계약", "웨딩홀을 결정하고 계약한다.", 1, List.of(item));
        Catalog catalog = new Catalog(List.of(new Category(1L, "웨딩홀", 1, List.of(step))));
        return new CatalogQueryResult(catalog, Set.of(item.id()));
    }

    private static MockHttpSession authenticatedSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER_ID_ATTRIBUTE, USER_ID);
        return session;
    }

    @Test
    @DisplayName("준비 목록을 계층 구조와 포함 여부로 응답한다")
    void shouldRespondCatalogWithHierarchyAndInclusion() throws Exception {
        // given
        when(catalogService.find(USER_ID)).thenReturn(constructTestResult());

        // when, then
        mockMvc.perform(get("/api/catalog").session(authenticatedSession()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categories[0].id").value(1))
                .andExpect(jsonPath("$.categories[0].name").value("웨딩홀"))
                .andExpect(jsonPath("$.categories[0].displayOrder").value(1))
                .andExpect(jsonPath("$.categories[0].steps[0].id").value(10))
                .andExpect(jsonPath("$.categories[0].steps[0].name").value("웨딩홀 계약"))
                .andExpect(jsonPath("$.categories[0].steps[0].description")
                        .value("웨딩홀을 결정하고 계약한다."))
                .andExpect(jsonPath("$.categories[0].steps[0].displayOrder").value(1))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].id").value(100))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].title").value("계약서 확인"))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].displayOrder").value(1))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].essential").value(true))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].included").value(true))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].categoryId").doesNotExist())
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].description").doesNotExist())
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].precedingItemIds").doesNotExist());
    }

    @Test
    @DisplayName("로그인하지 않아도 포함 여부 없이 준비 목록을 응답한다")
    void shouldRespondPublicCatalogWithoutAuthentication() throws Exception {
        // given
        when(catalogService.findPublicCatalog()).thenReturn(constructTestResult().catalog());

        // when, then
        mockMvc.perform(get("/api/catalog/public"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categories[0].id").value(1))
                .andExpect(jsonPath("$.categories[0].name").value("웨딩홀"))
                .andExpect(jsonPath("$.categories[0].displayOrder").value(1))
                .andExpect(jsonPath("$.categories[0].steps[0].id").value(10))
                .andExpect(jsonPath("$.categories[0].steps[0].name").value("웨딩홀 계약"))
                .andExpect(jsonPath("$.categories[0].steps[0].description")
                        .value("웨딩홀을 결정하고 계약한다."))
                .andExpect(jsonPath("$.categories[0].steps[0].displayOrder").value(1))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].id").value(100))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].title").value("계약서 확인"))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].displayOrder").value(1))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].essential").value(true))
                .andExpect(jsonPath("$.categories[0].steps[0].items[0].included").doesNotExist());
    }

    @Test
    @DisplayName("인증되지 않은 사용자의 준비 목록 조회 요청을 거부한다")
    void shouldRejectRequestWhenUnauthenticated() throws Exception {
        // when, then
        mockMvc.perform(get("/api/catalog"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value(201))
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."));
    }
}
