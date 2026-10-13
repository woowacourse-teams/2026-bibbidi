package com.bibbidi.wedding.chat.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.tools.dto.ChecklistToolItemResponse;
import com.bibbidi.wedding.chat.tools.dto.ChecklistToolResponse;
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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.support.ToolCallbacks;

class QueryToolsTest {

    private final CatalogService catalog = mock(CatalogService.class);
    private final ChecklistService checklist = mock(ChecklistService.class);
    private final ToolContext context = new ToolContext(new ChatToolContext(7L).toMap());

    @Test
    @DisplayName("카탈로그 도구는 기존 조회 서비스의 결과를 반환한다")
    void catalogUsesOnlyTheExistingReadService() {
        // given
        List<CatalogItemDetailSnapshot> items = List.of(new CatalogItemDetailSnapshot(100L, "계약서 확인", "웨딩홀", 1, "계약"));
        when(catalog.findAllItemDetails()).thenReturn(items);

        // when, then
        assertThat(new CatalogTools(catalog).findCatalog()).containsExactlyElementsOf(items);
        verify(catalog).findAllItemDetails();
        verifyNoMoreInteractions(catalog);
    }

    @Test
    @DisplayName("체크리스트 도구는 서버가 전달한 사용자로 조회하고 연결된 일정을 반환한다")
    void checklistUsesServerContextAndProvidesLinkedAppointments() {
        // given
        ChecklistAppointmentResult appointment = new ChecklistAppointmentResult(30L, "상담", LocalDate.of(2026, 11, 1), null, null,
                "서울", null, false);
        when(checklist.findMyChecklist(7L)).thenReturn(new ChecklistWithAppointmentsResult(10L, List.of(
                new ChecklistItemWithAppointmentsResult(20L, 2L, 100L, "계약서 확인", ChecklistItemStatus.CONTINUE,
                        LocalDateTime.of(2026, 10, 10, 10, 0), List.of(appointment)))));
        ChecklistTools tools = new ChecklistTools(checklist);

        // when
        ChecklistToolResponse result = tools.findMyChecklist(context);

        // then
        assertThat(result.exists()).isTrue();
        assertThat(result.items()).containsExactly(new ChecklistToolItemResponse(20L, 100L, "계약서 확인", "continue", List.of(appointment)));
        String schema = ToolCallbacks.from(tools)[0].getToolDefinition().inputSchema();
        assertThat(schema).doesNotContain("userId", "authenticatedUserId", "context");
        verify(checklist).findMyChecklist(7L);
        verifyNoMoreInteractions(checklist);
    }

    @Test
    @DisplayName("체크리스트가 없으면 빈 조회 결과를 반환한다")
    void missingChecklistReturnsNoPreparationData() {
        // given
        when(checklist.findMyChecklist(7L)).thenThrow(new BusinessException(ClientError.CHECKLIST_NOT_FOUND, "없음"));
        ChecklistTools tools = new ChecklistTools(checklist);

        // when
        ChecklistToolResponse result = tools.findMyChecklist(context);

        // then
        assertThat(result).isEqualTo(new ChecklistToolResponse(false, List.of()));
    }

    @Test
    @DisplayName("체크리스트 조회 장애가 발생하면 예외를 그대로 전파한다")
    void checklistLookupFailurePropagates() {
        // given
        BusinessException failure = new BusinessException(ClientError.INTERNAL_ERROR, "조회 장애");
        when(checklist.findMyChecklist(7L)).thenThrow(failure);
        ChecklistTools tools = new ChecklistTools(checklist);

        // when, then
        assertThatThrownBy(() -> tools.findMyChecklist(context)).isSameAs(failure);
    }

    @Test
    @DisplayName("서버의 사용자 정보가 없으면 예외를 던지고 체크리스트를 조회하지 않는다")
    void missingServerContextCannotSelectAUser() {
        // when, then
        assertThatThrownBy(() -> new ChecklistTools(checklist).findMyChecklist(new ToolContext(Map.of())))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(checklist);
    }

    @Test
    @DisplayName("서버의 사용자 ID 타입이 잘못되면 예외를 던지고 체크리스트를 조회하지 않는다")
    void invalidServerUserIdCannotSelectAUser() {
        // given
        ToolContext invalidContext = new ToolContext(Map.of("authenticatedUserId", "7"));

        // when, then
        assertThatThrownBy(() -> new ChecklistTools(checklist).findMyChecklist(invalidContext))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(checklist);
    }
}
