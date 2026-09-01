package com.bibbidi.wedding.checklist.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;

import com.bibbidi.wedding.appointment.service.ChecklistAppointmentService;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.checklist.service.dto.CatalogItemAdditionResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ChecklistServiceTest {

    private static final Long OWNER_ID = 1L;
    private static final Long CHECKLIST_ID = 10L;
    private static final Long OTHER_OWNER_ID = 2L;
    private static final Long CATEGORY_ID = 2L;
    private static final Long CONTRACT_ITEM_ID = 100L;
    private static final Long ESTIMATE_ITEM_ID = 101L;

    @Mock
    private ChecklistRepository checklistRepository;

    @Mock
    private CatalogService catalogService;

    @Mock
    private ChecklistAppointmentService checklistAppointmentService;

    private ChecklistService checklistService;

    @BeforeEach
    void setUp() {
        checklistService = new ChecklistService(
                checklistRepository,
                catalogService,
                checklistAppointmentService
        );
    }

    private static CatalogItemSnapshot contractItem() {
        return new CatalogItemSnapshot(CONTRACT_ITEM_ID, CATEGORY_ID, "계약서 확인");
    }

    private static CatalogItemSnapshot estimateItem() {
        return new CatalogItemSnapshot(ESTIMATE_ITEM_ID, CATEGORY_ID, "견적 비교");
    }

    @Test
    @DisplayName("소유자 ID로 빈 체크리스트를 생성한다")
    void shouldCreateForOwner() {
        // given
        given(checklistRepository.save(any(Checklist.class))).willReturn(new Checklist(10L, 1L, List.of()));

        // when
        ChecklistCreationResult result = checklistService.create(1L);

        // then
        assertThat(result).isEqualTo(new ChecklistCreationResult(10L));
    }

    @Test
    @DisplayName("자신의 체크리스트에 속한 할 일이면 소유권 검증을 통과한다")
    void shouldValidateItemOwnershipWhenItemBelongsToOwnersChecklist() {
        // given
        given(checklistRepository.getByChecklistItemId(200L))
                .willReturn(checklistOwnedBy(OWNER_ID));

        // when, then
        assertThatCode(() -> checklistService.validateItemOwnership(200L, OWNER_ID))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("다른 사용자의 체크리스트에 속한 할 일이면 소유권 검증에 실패한다")
    void shouldRejectItemOwnershipWhenItemBelongsToAnotherChecklist() {
        // given
        given(checklistRepository.getByChecklistItemId(200L))
                .willReturn(checklistOwnedBy(2L));

        // when, then
        assertThatThrownBy(() -> checklistService.validateItemOwnership(200L, OWNER_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);
    }

    @Test
    @DisplayName("존재하지 않는 할 일의 소유권 검증은 조회 오류를 그대로 전달한다")
    void shouldPropagateNotFoundWhenValidatingItemOwnership() {
        // given
        given(checklistRepository.getByChecklistItemId(999L))
                .willThrow(new BusinessException(ClientError.CHECKLIST_ITEM_NOT_FOUND, "not found"));

        // when, then
        assertThatThrownBy(() -> checklistService.validateItemOwnership(999L, OWNER_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_NOT_FOUND);
    }

    private static Checklist checklistOwnedBy(Long ownerId) {
        return new Checklist(CHECKLIST_ID, ownerId, List.of(item(200L)));
    }

    @Test
    @DisplayName("선택한 준비 항목을 사용자의 체크리스트에 할 일로 추가한다")
    void shouldAddSelectedCatalogItemsToChecklist() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID))
                .willReturn(checklistOwnedBy(OWNER_ID));
        given(catalogService.findItems(anyCollection())).willReturn(List.of(contractItem(), estimateItem()));
        given(checklistRepository.saveItems(any(Checklist.class), anyList()))
                .willAnswer(invocation -> invocation.getArgument(1));

        // when
        CatalogItemAdditionResult result =
                checklistService.addItemsFromCatalog(OWNER_ID, List.of(CONTRACT_ITEM_ID, ESTIMATE_ITEM_ID));

        // then
        assertThat(result.items())
                .extracting(
                        CatalogItemAdditionResult.AddedChecklistItem::catalogItemId,
                        CatalogItemAdditionResult.AddedChecklistItem::categoryId,
                        CatalogItemAdditionResult.AddedChecklistItem::isDone
                )
                .containsExactly(
                        tuple(CONTRACT_ITEM_ID, CATEGORY_ID, false),
                        tuple(ESTIMATE_ITEM_ID, CATEGORY_ID, false)
                );
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자의 추가 요청은 체크리스트를 찾지 못해 실패한다")
    void shouldFailWhenChecklistDoesNotExist() {
        // given
        willThrow(new BusinessException(ClientError.CHECKLIST_NOT_FOUND, "체크리스트 없음"))
                .given(checklistRepository)
                .getByOwnerId(OWNER_ID);

        // when, then
        assertThatThrownBy(() -> checklistService.addItemsFromCatalog(OWNER_ID, List.of(CONTRACT_ITEM_ID)))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_NOT_FOUND);
        then(checklistRepository).should(never()).saveItems(any(Checklist.class), anyList());
    }

    @Test
    @DisplayName("준비 목록에 없는 항목이 포함되면 아무것도 저장하지 않는다")
    void shouldRejectWhenCatalogItemDoesNotExist() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID))
                .willReturn(checklistOwnedBy(OWNER_ID));
        given(catalogService.findItems(anyCollection())).willReturn(List.of(contractItem()));

        // when, then
        assertThatThrownBy(() -> checklistService.addItemsFromCatalog(OWNER_ID, List.of(CONTRACT_ITEM_ID, 999L)))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.INVALID_REQUEST);
        then(checklistRepository).should(never()).saveItems(any(Checklist.class), anyList());
    }

    @Test
    @DisplayName("직접 적은 할 일을 사용자의 체크리스트에 추가한다")
    void shouldWriteCustomItemToChecklist() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID))
                .willReturn(checklistOwnedBy(OWNER_ID));
        given(checklistRepository.saveItem(any(Checklist.class), any(ChecklistItem.class)))
                .willAnswer(invocation -> invocation.getArgument(1));

        // when
        ChecklistItemResult result = checklistService.addCustomItem(OWNER_ID, "청첩장 문구 정하기", CATEGORY_ID);

        // then
        assertThat(result)
                .extracting(
                        ChecklistItemResult::catalogItemId,
                        ChecklistItemResult::categoryId,
                        ChecklistItemResult::title,
                        ChecklistItemResult::isDone
                )
                .containsExactly(null, CATEGORY_ID, "청첩장 문구 정하기", false);
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자의 직접 추가 요청은 체크리스트를 찾지 못해 실패한다")
    void shouldFailToWriteItemWhenChecklistDoesNotExist() {
        // given
        willThrow(new BusinessException(ClientError.CHECKLIST_NOT_FOUND, "체크리스트 없음"))
                .given(checklistRepository)
                .getByOwnerId(OWNER_ID);

        // when, then
        assertThatThrownBy(() -> checklistService.addCustomItem(OWNER_ID, "청첩장 문구 정하기", CATEGORY_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_NOT_FOUND);
        then(checklistRepository).should(never()).saveItem(any(Checklist.class), any(ChecklistItem.class));
    }

    @Test
    @DisplayName("준비 목록에 없는 카테고리로는 직접 할 일을 저장하지 않는다")
    void shouldRejectWriteWhenCategoryDoesNotExist() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID))
                .willReturn(checklistOwnedBy(OWNER_ID));
        willThrow(new BusinessException(ClientError.CATEGORY_NOT_FOUND, "not found"))
                .given(catalogService)
                .validateCategoryExists(999L);

        // when, then
        assertThatThrownBy(() -> checklistService.addCustomItem(OWNER_ID, "청첩장 문구 정하기", 999L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CATEGORY_NOT_FOUND);
        then(checklistRepository).should(never()).saveItem(any(Checklist.class), any(ChecklistItem.class));
    }

    @Test
    @DisplayName("준비 목록에서 가져온 미완료 할 일과 연결된 일정을 함께 삭제한다")
    void shouldDeleteIncompleteCatalogSourcedItemAndAppointments() {
        // given
        ChecklistItem item = item(200L, ChecklistItemStatus.PREV, 100L);
        Checklist checklist = new Checklist(CHECKLIST_ID, OWNER_ID, List.of(item));
        given(checklistRepository.findByChecklistItemId(item.id())).willReturn(Optional.of(checklist));

        // when
        checklistService.deleteItem(OWNER_ID, item.id());

        // then
        InOrder deletionOrder = inOrder(checklistAppointmentService, checklistRepository);
        deletionOrder.verify(checklistAppointmentService).deleteAllByChecklistItemId(item.id());
        deletionOrder.verify(checklistRepository).deleteItem(item);
    }

    @Test
    @DisplayName("없는 할 일은 이미 삭제된 것으로 처리한다")
    void shouldIgnoreDeletionWhenItemDoesNotExist() {
        // given
        given(checklistRepository.findByChecklistItemId(200L)).willReturn(Optional.empty());

        // when
        checklistService.deleteItem(OWNER_ID, 200L);

        // then
        then(checklistAppointmentService).shouldHaveNoInteractions();
        then(checklistRepository).should(never()).deleteItem(any(ChecklistItem.class));
    }

    @Test
    @DisplayName("다른 사용자의 할 일은 삭제할 수 없다")
    void shouldRejectDeletionWhenItemBelongsToAnotherUser() {
        // given
        ChecklistItem item = item(200L, ChecklistItemStatus.PREV, null);
        given(checklistRepository.findByChecklistItemId(item.id()))
                .willReturn(Optional.of(new Checklist(CHECKLIST_ID, 2L, List.of(item))));

        // when, then
        assertThatThrownBy(() -> checklistService.deleteItem(OWNER_ID, item.id()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);
        then(checklistAppointmentService).shouldHaveNoInteractions();
        then(checklistRepository).should(never()).deleteItem(any(ChecklistItem.class));
    }

    @Test
    @DisplayName("완료된 할 일은 삭제할 수 없다")
    void shouldRejectDeletionWhenItemIsDone() {
        // given
        ChecklistItem item = item(200L, ChecklistItemStatus.DONE, null);
        given(checklistRepository.findByChecklistItemId(item.id()))
                .willReturn(Optional.of(new Checklist(CHECKLIST_ID, OWNER_ID, List.of(item))));

        // when, then
        assertThatThrownBy(() -> checklistService.deleteItem(OWNER_ID, item.id()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.COMPLETED_CHECKLIST_ITEM_NOT_DELETABLE);
        then(checklistAppointmentService).shouldHaveNoInteractions();
        then(checklistRepository).should(never()).deleteItem(any(ChecklistItem.class));
    }

    @Test
    @DisplayName("일정 삭제가 실패하면 할 일을 삭제하지 않는다")
    void shouldNotDeleteItemWhenAppointmentDeletionFails() {
        // given
        ChecklistItem item = item(200L, ChecklistItemStatus.PREV, null);
        given(checklistRepository.findByChecklistItemId(item.id()))
                .willReturn(Optional.of(new Checklist(CHECKLIST_ID, OWNER_ID, List.of(item))));
        willThrow(new IllegalStateException("appointment deletion failed"))
                .given(checklistAppointmentService)
                .deleteAllByChecklistItemId(item.id());

        // when, then
        assertThatThrownBy(() -> checklistService.deleteItem(OWNER_ID, item.id()))
                .isInstanceOf(IllegalStateException.class);
        then(checklistRepository).should(never()).deleteItem(any(ChecklistItem.class));
    }

    @Test
    @DisplayName("연결된 일정을 먼저 삭제한 뒤 체크리스트를 통째로 삭제한다")
    void shouldDeleteAppointmentsBeforeChecklist() {
        List<Long> checklistItemIds = List.of(100L, 101L);
        Checklist checklist = new Checklist(
                CHECKLIST_ID,
                OWNER_ID,
                List.of(item(100L), item(101L))
        );
        given(checklistRepository.findByOwnerId(OWNER_ID)).willReturn(Optional.of(checklist));

        checklistService.deleteByOwnerId(OWNER_ID);

        InOrder order = inOrder(checklistAppointmentService, checklistRepository);
        order.verify(checklistAppointmentService).deleteAllByChecklistItemIds(checklistItemIds);
        order.verify(checklistRepository).delete(checklist);
    }

    @Test
    @DisplayName("체크리스트가 없으면 결혼 준비 데이터를 삭제하지 않는다")
    void shouldSkipDeletionWhenChecklistDoesNotExist() {
        given(checklistRepository.findByOwnerId(OWNER_ID)).willReturn(Optional.empty());

        checklistService.deleteByOwnerId(OWNER_ID);

        then(checklistRepository).should(never()).delete(any(Checklist.class));
        then(checklistAppointmentService).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("남은 일정 조회는 소유권을 확인한 뒤 일정 쪽 판단을 그대로 돌려준다")
    void shouldReturnRemainingAppointmentResultAfterOwnershipCheck() {
        // given
        ChecklistItem item = item(200L);
        given(checklistRepository.getByChecklistItemId(item.id()))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID, List.of(item)));
        given(checklistAppointmentService.hasRemainingAppointment(item.id())).willReturn(true);

        // when
        boolean hasRemaining = checklistService.hasRemainingAppointments(OWNER_ID, item.id());

        // then
        assertThat(hasRemaining).isTrue();
    }

    @Test
    @DisplayName("다른 사용자의 할 일은 남은 일정을 조회할 수 없다")
    void shouldRejectRemainingAppointmentLookupForOtherUsersItem() {
        // given
        ChecklistItem item = item(200L);
        given(checklistRepository.getByChecklistItemId(item.id()))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID, List.of(item)));

        // when, then
        assertThatThrownBy(() -> checklistService.hasRemainingAppointments(OTHER_OWNER_ID, item.id()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);
        then(checklistAppointmentService).shouldHaveNoInteractions();
    }

    private static ChecklistItem item(Long id) {
        return item(id, ChecklistItemStatus.PREV, null);
    }

    private static ChecklistItem item(
            Long id,
            ChecklistItemStatus status,
            Long sourceCatalogItemId
    ) {
        return new ChecklistItem(
                id,
                CATEGORY_ID,
                "계약서 확인",
                sourceCatalogItemId,
                status
        );
    }
}
