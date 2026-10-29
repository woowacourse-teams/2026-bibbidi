package com.bibbidi.wedding.chat.adapter.ai.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.chat.support.ToolCallingFixture;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChecklistServiceAdapterToolCallingTest {

    private static final Long USER_ID = 7L;
    private static final Long OTHER_USER_ID = 8L;

    private ChecklistService checklistService;
    private ToolCallingFixture toolCalling;

    @BeforeEach
    void setUp() {
        checklistService = mock(ChecklistService.class);
        toolCalling = new ToolCallingFixture(new ChecklistServiceAdapter(checklistService));
    }

    @Test
    @DisplayName("체크리스트 도구를 모델 요청에 등록한다")
    void registersTheChecklistToolsOnTheModelRequest() {
        assertThat(toolCalling.registeredToolNames(USER_ID)).containsExactlyInAnyOrder(
                "getMyChecklist", "changeChecklistItemStatus", "changeChecklistItemTitle", "deleteChecklistItem");
    }

    @Test
    @DisplayName("상태 변경 도구는 모델이 정한 인자가 아니라 요청에 담긴 사용자로 ChecklistService를 호출한다")
    void changesTheItemStatusForTheUserOfTheRequest() {
        // given
        when(checklistService.changeItemStatus(USER_ID, 10L, "done")).thenReturn(
                new ChecklistItemResult(10L, 5L, 1L, "웨딩홀 투어", ChecklistItemStatus.DONE,
                        LocalDateTime.of(2026, 10, 1, 9, 0)));

        // when
        String response = toolCalling.callTool(USER_ID, "changeChecklistItemStatus",
                "{\"checklistItemId\": 10, \"status\": \"done\", \"userId\": " + OTHER_USER_ID + "}");

        // then
        verify(checklistService).changeItemStatus(USER_ID, 10L, "done");
        verify(checklistService, never()).changeItemStatus(eq(OTHER_USER_ID), any(), any());
        assertThat(response).contains("웨딩홀 투어");
        assertThat(toolCalling.writeSucceeded()).isTrue();
    }

    @Test
    @DisplayName("삭제 도구는 요청에 담긴 사용자로 할 일을 삭제한다")
    void deletesTheItemForTheUserOfTheRequest() {
        toolCalling.callTool(USER_ID, "deleteChecklistItem", "{\"checklistItemId\": 10}");

        verify(checklistService).deleteItem(USER_ID, 10L);
        assertThat(toolCalling.writeSucceeded()).isTrue();
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
        assertThat(toolCalling.writeSucceeded()).isFalse();
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
