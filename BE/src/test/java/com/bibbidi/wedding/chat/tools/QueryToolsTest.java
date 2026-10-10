package com.bibbidi.wedding.chat.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistAppointmentResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemWithAppointmentsResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.support.ToolCallbacks;

class QueryToolsTest {

    private final CatalogService catalog = mock(CatalogService.class);
    private final ChecklistService checklist = mock(ChecklistService.class);
    private final ToolContext context = new ToolContext(new ChatToolContext(7L).toMap());

    @Test
    void catalogUsesOnlyTheExistingReadService() {
        var items = List.of(new CatalogItemDetailSnapshot(100L, "계약서 확인", "웨딩홀", 1, "계약"));
        when(catalog.findAllItemDetails()).thenReturn(items);
        assertThat(new CatalogTools(catalog).findCatalog()).containsExactlyElementsOf(items);
        verify(catalog).findAllItemDetails();
        verifyNoMoreInteractions(catalog);
    }

    @Test
    void checklistUsesServerContextAndProvidesLinkedAppointments() {
        var appointment = new ChecklistAppointmentResult(30L, "상담", LocalDate.of(2026, 11, 1), null, null,
                "서울", null, false);
        when(checklist.findMyChecklist(7L)).thenReturn(new ChecklistWithAppointmentsResult(10L, List.of(
                new ChecklistItemWithAppointmentsResult(20L, 2L, 100L, "계약서 확인", ChecklistItemStatus.CONTINUE,
                        LocalDateTime.of(2026, 10, 10, 10, 0), List.of(appointment)))));
        var tools = new ChecklistTools(checklist);

        var result = tools.findMyChecklist(context);

        assertThat(result.exists()).isTrue();
        assertThat(result.items()).containsExactly(new ChecklistTools.Item(20L, 100L, "계약서 확인", "continue", List.of(appointment)));
        String schema = ToolCallbacks.from(tools)[0].getToolDefinition().inputSchema();
        assertThat(schema).doesNotContain("userId", "authenticatedUserId", "context");
        verify(checklist).findMyChecklist(7L);
        verifyNoMoreInteractions(checklist);
    }

    @Test
    void onlyMissingChecklistIsTreatedAsNoPreparationData() {
        when(checklist.findMyChecklist(7L)).thenThrow(new BusinessException(ClientError.CHECKLIST_NOT_FOUND, "없음"));
        assertThat(new ChecklistTools(checklist).findMyChecklist(context))
                .isEqualTo(new ChecklistTools.ChecklistDetails(false, List.of()));
        doThrow(new BusinessException(ClientError.INTERNAL_ERROR, "조회 장애")).when(checklist).findMyChecklist(7L);
        assertThatThrownBy(() -> new ChecklistTools(checklist).findMyChecklist(context))
                .isInstanceOf(BusinessException.class).hasMessage("조회 장애");
    }

    @Test
    void missingServerContextCannotSelectAUser() {
        assertThatThrownBy(() -> new ChecklistTools(checklist).findMyChecklist(new ToolContext(Map.of())))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(checklist);
    }

    @Test
    void invalidServerUserIdCannotSelectAUser() {
        ToolContext invalidContext = new ToolContext(Map.of("authenticatedUserId", "7"));

        assertThatThrownBy(() -> new ChecklistTools(checklist).findMyChecklist(invalidContext))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(checklist);
    }
}
