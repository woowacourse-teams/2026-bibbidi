package com.bibbidi.wedding.chat.adapter.ai.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.support.ToolCallingFixture;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChecklistServiceAdapterToolCallingTest {

    private static final Long USER_ID = 7L;
    private static final Long OTHER_USER_ID = 8L;

    private ChecklistService checklistService;
    private CatalogService catalogService;
    private ToolCallingFixture toolCalling;

    @BeforeEach
    void setUp() {
        checklistService = mock(ChecklistService.class);
        catalogService = mock(CatalogService.class);
        toolCalling = new ToolCallingFixture(new ChecklistServiceAdapter(checklistService, catalogService));
    }

    @Test
    @DisplayName("체크리스트 조회 도구와 추천 후보 조회 도구를 모델 요청에 등록한다")
    void registersTheChecklistToolsOnTheModelRequest() {
        assertThat(toolCalling.registeredToolNames(USER_ID))
                .containsExactlyInAnyOrder("getMyChecklist", "getRecommendableItemIds");
    }

    @Test
    @DisplayName("모델이 getMyChecklist를 호출하면 요청한 사용자의 체크리스트를 ChecklistService로 조회한다")
    void callsChecklistServiceWithTheRequestingUserWhenTheModelCallsGetMyChecklist() {
        // given
        when(checklistService.findMyChecklistIfPresent(USER_ID))
                .thenReturn(Optional.of(new ChecklistWithAppointmentsResult(10L, List.of())));

        // when
        String response = toolCalling.callTool(USER_ID, "getMyChecklist", "{}");

        // then
        verify(checklistService).findMyChecklistIfPresent(USER_ID);
        assertThat(response).contains("\"exists\":true");
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자가 getMyChecklist를 호출하면 없는 상태로 응답한다")
    void respondsThatTheChecklistDoesNotExistWhenTheUserHasNone() {
        // given
        when(checklistService.findMyChecklistIfPresent(USER_ID)).thenReturn(Optional.empty());

        // when
        String response = toolCalling.callTool(USER_ID, "getMyChecklist", "{}");

        // then
        assertThat(response).contains("\"exists\":false");
    }

    @Test
    @DisplayName("모델이 getRecommendableItemIds를 호출하면 카탈로그 전체를 조회해 추천 가능한 항목만 거른다")
    void filtersTheWholeCatalogWhenTheModelCallsGetRecommendableItemIds() {
        // given
        when(catalogService.findAllItemDetails()).thenReturn(List.of(
                new CatalogItemDetailSnapshot(1L, "웨딩홀 후보 정하기", "웨딩홀", 1, "후보"),
                new CatalogItemDetailSnapshot(2L, "스튜디오 후보 정하기", "촬영", 1, "후보"),
                new CatalogItemDetailSnapshot(3L, "드레스 후보 정하기", "드레스", 1, "후보")));
        when(checklistService.filterRecommendableCatalogItemIds(USER_ID, List.of(1L, 2L, 3L)))
                .thenReturn(List.of(1L, 3L));

        // when
        String response = toolCalling.callTool(USER_ID, "getRecommendableItemIds", "{}");

        // then
        verify(catalogService).findAllItemDetails();
        verify(checklistService).filterRecommendableCatalogItemIds(USER_ID, List.of(1L, 2L, 3L));
        assertThat(response).isEqualTo("[1,3]");
    }

    @Test
    @DisplayName("도구는 모델이 정한 인자가 아니라 요청에 담긴 사용자로 조회한다")
    void usesTheUserOfTheRequestInsteadOfTheModelArguments() {
        // given
        when(checklistService.findMyChecklistIfPresent(USER_ID)).thenReturn(Optional.empty());

        // when
        toolCalling.callTool(USER_ID, "getMyChecklist", "{\"userId\": " + OTHER_USER_ID + "}");

        // then
        verify(checklistService).findMyChecklistIfPresent(USER_ID);
        verify(checklistService, never()).findMyChecklistIfPresent(OTHER_USER_ID);
    }
}
