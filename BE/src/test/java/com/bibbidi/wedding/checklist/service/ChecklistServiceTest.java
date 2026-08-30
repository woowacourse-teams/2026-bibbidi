package com.bibbidi.wedding.checklist.service;

import static org.assertj.core.api.Assertions.assertThat;
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

import com.bibbidi.wedding.appointment.service.ChecklistAppointmentDeleteService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.repository.ChecklistItemRepository;
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
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class ChecklistServiceTest {

    private static final Long OWNER_ID = 1L;
    private static final Long CHECKLIST_ID = 10L;
    private static final Long CATEGORY_ID = 2L;
    private static final Long CONTRACT_ITEM_ID = 100L;
    private static final Long ESTIMATE_ITEM_ID = 101L;

    @Mock
    private ChecklistRepository checklistRepository;

    @Mock
    private ChecklistItemRepository checklistItemRepository;

    @Mock
    private CatalogService catalogService;

    @Mock
    private ChecklistAppointmentDeleteService checklistAppointmentDeleteService;

    private ChecklistService checklistService;

    @BeforeEach
    void setUp() {
        checklistService = new ChecklistService(
                checklistRepository,
                checklistItemRepository,
                catalogService,
                checklistAppointmentDeleteService
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
    void shouldCreateChecklistForOwner() {
        // given
        given(checklistRepository.existsByOwnerId(1L)).willReturn(false);
        given(checklistRepository.save(any(Checklist.class))).willReturn(new Checklist(10L, 1L));

        // when
        ChecklistCreationResult result = checklistService.create(1L);

        // then
        assertThat(result).isEqualTo(new ChecklistCreationResult(10L));
    }

    @Test
    @DisplayName("소유자의 체크리스트가 이미 존재하면 생성을 거절한다")
    void shouldRejectWhenChecklistAlreadyExists() {
        // given
        given(checklistRepository.existsByOwnerId(1L)).willReturn(true);

        // when, then
        assertThatThrownBy(() -> checklistService.create(1L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DUPLICATE_CHECKLIST);
        then(checklistRepository).should(never()).save(any(Checklist.class));
    }

    @Test
    @DisplayName("동시 생성으로 UNIQUE 제약을 위반하면 중복 체크리스트 오류로 변환한다")
    void shouldConvertUniqueConstraintViolationToDuplicateChecklistError() {
        // given
        given(checklistRepository.existsByOwnerId(1L)).willReturn(false);
        willThrow(new DataIntegrityViolationException("duplicate owner"))
                .given(checklistRepository)
                .save(any(Checklist.class));

        // when, then
        assertThatThrownBy(() -> checklistService.create(1L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DUPLICATE_CHECKLIST);
    }

    @Test
    @DisplayName("자신의 체크리스트에 속한 할 일이면 소유권을 인정한다")
    void shouldConfirmItemOwnershipWhenItemBelongsToOwnersChecklist() {
        // given
        given(checklistItemRepository.findById(200L)).willReturn(Optional.of(itemOwnedBy(OWNER_ID)));

        // when, then
        assertThat(checklistService.checkItemOwnership(200L, OWNER_ID)).isTrue();
    }

    @Test
    @DisplayName("다른 사용자의 체크리스트에 속한 할 일이면 소유권을 인정하지 않는다")
    void shouldDenyItemOwnershipWhenItemBelongsToAnotherChecklist() {
        // given
        given(checklistItemRepository.findById(200L)).willReturn(Optional.of(itemOwnedBy(2L)));

        // when, then
        assertThat(checklistService.checkItemOwnership(200L, OWNER_ID)).isFalse();
    }

    @Test
    @DisplayName("존재하지 않는 할 일은 소유권을 인정하지 않는다")
    void shouldDenyItemOwnershipWhenItemDoesNotExist() {
        // given
        given(checklistItemRepository.findById(999L)).willReturn(Optional.empty());

        // when, then
        assertThat(checklistService.checkItemOwnership(999L, OWNER_ID)).isFalse();
    }

    private static ChecklistItem itemOwnedBy(Long ownerId) {
        return new ChecklistItem(
                200L,
                new Checklist(CHECKLIST_ID, ownerId),
                CATEGORY_ID,
                "계약서 확인",
                null,
                ChecklistItemStatus.PREV
        );
    }

    @Test
    @DisplayName("선택한 준비 항목을 사용자의 체크리스트에 할 일로 추가한다")
    void shouldAddSelectedCatalogItemsToChecklist() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID));
        given(catalogService.findItems(anyCollection())).willReturn(List.of(contractItem(), estimateItem()));
        given(checklistItemRepository.saveAll(anyList())).willAnswer(invocation -> invocation.getArgument(0));

        // when
        CatalogItemAdditionResult result =
                checklistService.addCatalogItems(OWNER_ID, List.of(CONTRACT_ITEM_ID, ESTIMATE_ITEM_ID));

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
        assertThatThrownBy(() -> checklistService.addCatalogItems(OWNER_ID, List.of(CONTRACT_ITEM_ID)))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_NOT_FOUND);
        then(checklistItemRepository).should(never()).saveAll(anyList());
    }

    @Test
    @DisplayName("준비 목록에 없는 항목이 포함되면 아무것도 저장하지 않는다")
    void shouldRejectWhenCatalogItemDoesNotExist() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID));
        given(catalogService.findItems(anyCollection())).willReturn(List.of(contractItem()));

        // when, then
        assertThatThrownBy(() -> checklistService.addCatalogItems(OWNER_ID, List.of(CONTRACT_ITEM_ID, 999L)))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.INVALID_REQUEST);
        then(checklistItemRepository).should(never()).saveAll(anyList());
    }

    @Test
    @DisplayName("이미 추가된 준비 항목이라 UNIQUE 제약을 위반하면 중복 오류로 변환한다")
    void shouldConvertUniqueConstraintViolationToDuplicateChecklistItemError() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID));
        given(catalogService.findItems(anyCollection())).willReturn(List.of(contractItem()));
        willThrow(new DataIntegrityViolationException("duplicate checklist item"))
                .given(checklistItemRepository)
                .saveAll(anyList());

        // when, then
        assertThatThrownBy(() -> checklistService.addCatalogItems(OWNER_ID, List.of(CONTRACT_ITEM_ID)))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DUPLICATE_CHECKLIST_ITEM);
    }

    @Test
    @DisplayName("직접 적은 할 일을 사용자의 체크리스트에 추가한다")
    void shouldWriteCustomItemToChecklist() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID));
        given(catalogService.existsCategory(CATEGORY_ID)).willReturn(true);
        given(checklistItemRepository.save(any(ChecklistItem.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

        // when
        ChecklistItemResult result = checklistService.writeItem(OWNER_ID, "청첩장 문구 정하기", CATEGORY_ID);

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
        assertThatThrownBy(() -> checklistService.writeItem(OWNER_ID, "청첩장 문구 정하기", CATEGORY_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_NOT_FOUND);
        then(checklistItemRepository).should(never()).save(any(ChecklistItem.class));
    }

    @Test
    @DisplayName("준비 목록에 없는 카테고리로는 직접 할 일을 저장하지 않는다")
    void shouldRejectWriteWhenCategoryDoesNotExist() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID));
        given(catalogService.existsCategory(999L)).willReturn(false);

        // when, then
        assertThatThrownBy(() -> checklistService.writeItem(OWNER_ID, "청첩장 문구 정하기", 999L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CATEGORY_NOT_FOUND);
        then(checklistItemRepository).should(never()).save(any(ChecklistItem.class));
    }

    @Test
    @DisplayName("일정, 할 일, 체크리스트 순서로 삭제한다")
    void shouldDeleteChecklistDataInForeignKeyOrder() {
        Checklist checklist = new Checklist(CHECKLIST_ID, OWNER_ID);
        List<Long> checklistItemIds = List.of(100L, 101L);
        given(checklistRepository.findByOwnerId(OWNER_ID)).willReturn(Optional.of(checklist));
        given(checklistItemRepository.findIdsByChecklistId(CHECKLIST_ID)).willReturn(checklistItemIds);

        checklistService.deleteByOwnerId(OWNER_ID);

        InOrder order = inOrder(checklistAppointmentDeleteService, checklistItemRepository, checklistRepository);
        order.verify(checklistAppointmentDeleteService).deleteAllByChecklistItemIds(checklistItemIds);
        order.verify(checklistItemRepository).deleteAllByChecklistId(CHECKLIST_ID);
        order.verify(checklistRepository).deleteById(CHECKLIST_ID);
    }

    @Test
    @DisplayName("체크리스트가 없으면 결혼 준비 데이터를 삭제하지 않는다")
    void shouldSkipDeletionWhenChecklistDoesNotExist() {
        given(checklistRepository.findByOwnerId(OWNER_ID)).willReturn(Optional.empty());

        checklistService.deleteByOwnerId(OWNER_ID);

        then(checklistItemRepository).shouldHaveNoInteractions();
        then(checklistAppointmentDeleteService).shouldHaveNoInteractions();
    }
}
