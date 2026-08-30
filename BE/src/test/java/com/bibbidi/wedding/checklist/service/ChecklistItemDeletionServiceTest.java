package com.bibbidi.wedding.checklist.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;

import com.bibbidi.wedding.appointment.service.AppointmentDeleteService;
import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.repository.ChecklistItemRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ChecklistItemDeletionServiceTest {

    private static final Long OWNER_ID = 1L;
    private static final Long CHECKLIST_ITEM_ID = 10L;

    @Mock
    private ChecklistItemRepository checklistItemRepository;

    @Mock
    private AppointmentDeleteService appointmentDeleteService;

    private ChecklistItemDeletionService checklistItemDeletionService;

    @BeforeEach
    void setUp() {
        checklistItemDeletionService = new ChecklistItemDeletionService(
                checklistItemRepository,
                appointmentDeleteService
        );
    }

    @Test
    @DisplayName("없는 할 일 삭제는 이미 삭제된 것으로 처리한다")
    void shouldIgnoreDeletionWhenItemDoesNotExist() {
        given(checklistItemRepository.findById(CHECKLIST_ITEM_ID)).willReturn(Optional.empty());

        checklistItemDeletionService.delete(OWNER_ID, CHECKLIST_ITEM_ID);

        then(appointmentDeleteService).shouldHaveNoInteractions();
        then(checklistItemRepository).should(never()).deleteById(any());
    }

    @Test
    @DisplayName("다른 사용자의 할 일은 삭제할 수 없다")
    void shouldRejectDeletionWhenItemBelongsToAnotherUser() {
        given(checklistItemRepository.findById(CHECKLIST_ITEM_ID))
                .willReturn(Optional.of(item(2L, ChecklistItemStatus.PREV, null)));

        assertThatThrownBy(() -> checklistItemDeletionService.delete(OWNER_ID, CHECKLIST_ITEM_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);
        then(appointmentDeleteService).shouldHaveNoInteractions();
        then(checklistItemRepository).should(never()).deleteById(any());
    }

    @Test
    @DisplayName("완료된 할 일은 삭제할 수 없다")
    void shouldRejectDeletionWhenItemIsDone() {
        given(checklistItemRepository.findById(CHECKLIST_ITEM_ID))
                .willReturn(Optional.of(item(OWNER_ID, ChecklistItemStatus.DONE, null)));

        assertThatThrownBy(() -> checklistItemDeletionService.delete(OWNER_ID, CHECKLIST_ITEM_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.COMPLETED_CHECKLIST_ITEM_NOT_DELETABLE);
        then(appointmentDeleteService).shouldHaveNoInteractions();
        then(checklistItemRepository).should(never()).deleteById(any());
    }

    @Test
    @DisplayName("준비 목록에서 가져온 미완료 할 일과 연결된 일정을 함께 삭제한다")
    void shouldDeleteIncompleteCatalogSourcedItemAndAppointments() {
        given(checklistItemRepository.findById(CHECKLIST_ITEM_ID))
                .willReturn(Optional.of(item(OWNER_ID, ChecklistItemStatus.PREV, 100L)));

        checklistItemDeletionService.delete(OWNER_ID, CHECKLIST_ITEM_ID);

        InOrder deletionOrder = inOrder(appointmentDeleteService, checklistItemRepository);
        deletionOrder.verify(appointmentDeleteService).deleteAllByChecklistItemId(CHECKLIST_ITEM_ID);
        deletionOrder.verify(checklistItemRepository).deleteById(CHECKLIST_ITEM_ID);
    }

    @Test
    @DisplayName("일정 삭제가 실패하면 할 일을 삭제하지 않는다")
    void shouldNotDeleteItemWhenAppointmentDeletionFails() {
        given(checklistItemRepository.findById(CHECKLIST_ITEM_ID))
                .willReturn(Optional.of(item(OWNER_ID, ChecklistItemStatus.PREV, null)));
        willThrow(new IllegalStateException("appointment deletion failed"))
                .given(appointmentDeleteService)
                .deleteAllByChecklistItemId(CHECKLIST_ITEM_ID);

        assertThatThrownBy(() -> checklistItemDeletionService.delete(OWNER_ID, CHECKLIST_ITEM_ID))
                .isInstanceOf(IllegalStateException.class);
        then(checklistItemRepository).should(never()).deleteById(any());
    }

    private static ChecklistItem item(Long ownerId, ChecklistItemStatus status, Long sourceCatalogItemId) {
        return new ChecklistItem(
                CHECKLIST_ITEM_ID,
                new Checklist(100L, ownerId),
                2L,
                "청첩장 문구 정하기",
                sourceCatalogItemId,
                status
        );
    }
}
