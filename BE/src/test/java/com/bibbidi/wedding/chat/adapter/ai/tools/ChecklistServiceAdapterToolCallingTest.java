package com.bibbidi.wedding.chat.adapter.ai.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
    private ToolCallingFixture toolCalling;

    @BeforeEach
    void setUp() {
        checklistService = mock(ChecklistService.class);
        toolCalling = new ToolCallingFixture(new ChecklistServiceAdapter(checklistService));
    }

    @Test
    @DisplayName("체크리스트 조회 도구를 모델 요청에 등록한다")
    void registersTheChecklistToolsOnTheModelRequest() {
        assertThat(toolCalling.registeredToolNames(USER_ID))
                .containsExactly("getMyChecklist");
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
