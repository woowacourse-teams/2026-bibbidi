package com.bibbidi.wedding.chat.adapter.ai.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.support.ToolCallingFixture;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CatalogServiceAdapterToolCallingTest {

    private static final Long USER_ID = 7L;

    private CatalogService catalogService;
    private ToolCallingFixture toolCalling;

    @BeforeEach
    void setUp() {
        catalogService = mock(CatalogService.class);
        toolCalling = new ToolCallingFixture(new CatalogServiceAdapter(catalogService));
    }

    @Test
    @DisplayName("카탈로그 조회 도구를 모델 요청에 등록한다")
    void registersTheCatalogToolOnTheModelRequest() {
        assertThat(toolCalling.registeredToolNames(USER_ID)).containsExactly("getCatalog");
    }

    @Test
    @DisplayName("모델이 getCatalog를 호출하면 CatalogService로 카탈로그를 조회한다")
    void callsCatalogServiceWhenTheModelCallsGetCatalog() {
        // given
        when(catalogService.findAllItemDetails()).thenReturn(List.of());

        // when
        toolCalling.callTool(USER_ID, "getCatalog", "{}");

        // then
        verify(catalogService).findAllItemDetails();
        verifyNoMoreInteractions(catalogService);
    }

    @Test
    @DisplayName("모델이 getCatalog를 호출하면 조회한 카탈로그 항목을 도구 응답으로 돌려준다")
    void returnsTheCatalogItemsAsTheToolResponse() {
        // given
        when(catalogService.findAllItemDetails()).thenReturn(List.of(
                new CatalogItemDetailSnapshot(1L, "웨딩홀 후보 정하기", "웨딩홀", 1, "후보"),
                new CatalogItemDetailSnapshot(2L, "스튜디오 후보 정하기", "촬영", 1, "후보")));

        // when
        String response = toolCalling.callTool(USER_ID, "getCatalog", "{}");

        // then
        assertThat(response).contains("웨딩홀 후보 정하기", "스튜디오 후보 정하기");
    }
}
