package com.bibbidi.wedding.chat.service;

import static com.bibbidi.wedding.chat.ChatTestFixtures.CLOCK;
import static com.bibbidi.wedding.chat.ChatTestFixtures.NOW;
import static com.bibbidi.wedding.chat.ChatTestFixtures.OWNER_ID;
import static com.bibbidi.wedding.chat.ChatTestFixtures.TODAY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.domain.PreparationAppointment;
import com.bibbidi.wedding.chat.domain.PreparationCatalogItem;
import com.bibbidi.wedding.chat.domain.PreparationChecklistItem;
import com.bibbidi.wedding.chat.domain.PreparationChecklistItemStatus;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistAppointmentResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemWithAppointmentsResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserService;
import com.bibbidi.wedding.user.service.WeddingDateResult;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class PreparationContextServiceTest {

    private final ChecklistService checklistService = mock(ChecklistService.class);
    private final UserService userService = mock(UserService.class);
    private final CatalogService catalogService = mock(CatalogService.class);
    private final PreparationContextService service = new PreparationContextService(checklistService, userService,
            catalogService, CLOCK);

    @Test
    @DisplayName("기존 조회 서비스로 할 일과 일정과 예식 날짜와 전체 카탈로그를 구성한다")
    void shouldLoadPreparationFromExistingServices() {
        var appointment = new ChecklistAppointmentResult(200L, "드레스 피팅", TODAY.minusDays(1),
                TODAY.minusDays(1).atTime(14, 0), TODAY.minusDays(1).atTime(15, 0), "피팅샵", "피팅 메모", false);
        var item = new ChecklistItemWithAppointmentsResult(10L, 1L, 100L, "드레스 투어", ChecklistItemStatus.CONTINUE,
                null, List.of(appointment));
        when(userService.findWeddingDate(OWNER_ID)).thenReturn(new WeddingDateResult(TODAY.plusMonths(6)));
        when(checklistService.findMyChecklist(OWNER_ID)).thenReturn(new ChecklistWithAppointmentsResult(1L, List.of(item)));
        when(catalogService.findAllItemDetails()).thenReturn(List.of(
                new CatalogItemDetailSnapshot(100L, "드레스 투어", "스드메", 1, "계약"),
                new CatalogItemDetailSnapshot(101L, "드레스 피팅", "스드메", 2, "피팅")
        ));

        PreparationSnapshot snapshot = service.load(OWNER_ID);

        assertThat(snapshot.weddingDate()).isEqualTo(TODAY.plusMonths(6));
        assertThat(snapshot.queriedAt()).isEqualTo(NOW);
        assertThat(snapshot.checklistItems()).containsExactly(new PreparationChecklistItem(10L, 1L, 100L,
                "드레스 투어", PreparationChecklistItemStatus.CONTINUE, List.of(new PreparationAppointment(200L, "드레스 피팅",
                appointment.date(), appointment.startTime(), appointment.endTime(), "피팅샵", "피팅 메모", false))));
        assertThat(snapshot.catalogItems()).hasSize(2);
        assertThat(snapshot.catalogItems().getLast()).isEqualTo(
                new PreparationCatalogItem(101L, "드레스 피팅", "스드메", 2, "피팅"));
        assertThat(snapshot.recommendationCandidates()).extracting(PreparationCatalogItem::id)
                .containsExactly(101L);
        verify(userService).findWeddingDate(OWNER_ID);
        verify(checklistService).findMyChecklist(OWNER_ID);
        verify(catalogService).findAllItemDetails();
    }

    @ParameterizedTest
    @EnumSource(ChecklistItemStatus.class)
    @DisplayName("기존 할 일 상태를 chat의 상태 타입으로 변환한다")
    void shouldConvertAllExistingStatuses(ChecklistItemStatus status) {
        var item = new ChecklistItemWithAppointmentsResult(10L, null, null, "개인 할 일", status, null, List.of());
        when(userService.findWeddingDate(OWNER_ID)).thenReturn(new WeddingDateResult(null));
        when(checklistService.findMyChecklist(OWNER_ID)).thenReturn(new ChecklistWithAppointmentsResult(1L, List.of(item)));
        when(catalogService.findAllItemDetails()).thenReturn(List.of());

        PreparationSnapshot snapshot = service.load(OWNER_ID);

        assertThat(snapshot.checklistItems().getFirst().status()).isEqualTo(PreparationChecklistItemStatus.valueOf(status.name()));
        assertThat(snapshot.weddingDate()).isNull();
        assertThat(snapshot.checklistItems().getFirst().sourceCatalogItemId()).isNull();
    }

    @Test
    @DisplayName("사용자 조회 실패를 준비 정보 없음으로 바꾸지 않는다")
    void shouldPropagateUserLookupFailure() {
        var failure = new BusinessException(ClientError.USER_NOT_FOUND, "사용자 조회 실패");
        when(userService.findWeddingDate(OWNER_ID)).thenThrow(failure);

        assertThatThrownBy(() -> service.load(OWNER_ID)).isSameAs(failure);
        verifyNoInteractions(checklistService, catalogService);
    }

    @Test
    @DisplayName("체크리스트가 없는 조회 실패를 빈 목록으로 바꾸지 않는다")
    void shouldPropagateChecklistLookupFailure() {
        when(userService.findWeddingDate(OWNER_ID)).thenReturn(new WeddingDateResult(null));
        var failure = new BusinessException(ClientError.CHECKLIST_NOT_FOUND, "체크리스트 조회 실패");
        when(checklistService.findMyChecklist(OWNER_ID)).thenThrow(failure);

        assertThatThrownBy(() -> service.load(OWNER_ID)).isSameAs(failure);
        verifyNoInteractions(catalogService);
    }

    @Test
    @DisplayName("카탈로그 조회 실패는 부분 스냅샷을 반환하지 않는다")
    void shouldPropagateCatalogLookupFailure() {
        when(userService.findWeddingDate(OWNER_ID)).thenReturn(new WeddingDateResult(null));
        when(checklistService.findMyChecklist(OWNER_ID)).thenReturn(new ChecklistWithAppointmentsResult(1L, List.of()));
        var failure = new IllegalStateException("카탈로그 조회 실패");
        when(catalogService.findAllItemDetails()).thenThrow(failure);

        assertThatThrownBy(() -> service.load(OWNER_ID)).isSameAs(failure);
    }
}
