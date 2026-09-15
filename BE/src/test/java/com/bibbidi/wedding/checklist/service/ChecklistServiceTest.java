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

import com.bibbidi.wedding.checklist.service.dto.AppointmentSummaryResult;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import com.bibbidi.wedding.catalog.service.dto.CategoryNames;
import com.bibbidi.wedding.checklist.domain.Appointment;
import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.checklist.service.dto.CatalogItemAdditionResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistProgressResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import com.bibbidi.wedding.checklist.service.dto.RecommendedCatalogItemResult;
import com.bibbidi.wedding.checklist.service.dto.UnscheduledChecklistItemResult;
import com.bibbidi.wedding.checklist.util.Shuffler;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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

    private static final CatalogItemDetailSnapshot HALL_TOUR =
            new CatalogItemDetailSnapshot(1L, "웨딩홀 투어", "웨딩홀", 1, "웨딩홀 정하기");
    private static final CatalogItemDetailSnapshot HALL_CONTRACT =
            new CatalogItemDetailSnapshot(2L, "웨딩홀 계약", "웨딩홀", 1, "웨딩홀 정하기");
    private static final CatalogItemDetailSnapshot CEREMONY_TYPE =
            new CatalogItemDetailSnapshot(3L, "예식 형태 결정", "웨딩홀", 2, "예식 진행 방식 결정");
    private static final CatalogItemDetailSnapshot HOST_BOOKING =
            new CatalogItemDetailSnapshot(6L, "주례·사회자 섭외", "웨딩홀", 3, "예식 진행 인원 섭외");
    private static final CatalogItemDetailSnapshot STYLING_CONSULTING =
            new CatalogItemDetailSnapshot(39L, "스드메 상담", "스드메", 1, "스드메 패키지 계약");
    private static final CatalogItemDetailSnapshot DRESS_SHOP =
            new CatalogItemDetailSnapshot(44L, "드레스샵 확정", "스드메", 2, "스드메 업체 확정");
    private static final List<CatalogItemDetailSnapshot> ALL_ITEM_DETAILS = List.of(
            HALL_TOUR, HALL_CONTRACT, CEREMONY_TYPE, HOST_BOOKING, STYLING_CONSULTING, DRESS_SHOP
    );

    @Mock
    private ChecklistRepository checklistRepository;

    @Mock
    private CatalogService catalogService;

    @Mock
    private ChecklistAppointmentService checklistAppointmentService;

    @Mock
    private Shuffler shuffler;

    private ChecklistService checklistService;

    @BeforeEach
    void setUp() {
        checklistService = new ChecklistService(
                checklistRepository,
                catalogService,
                checklistAppointmentService,
                shuffler
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
    @DisplayName("모든 할 일과 해당 일정을 조회한다")
    void shouldFindChecklistWithAppointments() {
        ChecklistItem incompleteItem = constructTestItem(200L);
        ChecklistItem completedItem = constructTestItem(201L, ChecklistItemStatus.DONE, null);
        Checklist checklist = new Checklist(CHECKLIST_ID, OWNER_ID, List.of(incompleteItem, completedItem));
        AppointmentSummaryResult appointment = new AppointmentSummaryResult(
                300L,
                incompleteItem.id(),
                "appointment",
                java.time.LocalDate.of(2026, 9, 1),
                null,
                null,
                null,
                "memo",
                false
        );
        given(checklistRepository.getByOwnerId(OWNER_ID)).willReturn(checklist);
        given(checklistAppointmentService.findAllByChecklistItemIdInOrderByCreatedAtAscIdAsc(
                List.of(incompleteItem.id(), completedItem.id())))
                .willReturn(List.of(appointment));

        ChecklistWithAppointmentsResult result = checklistService.findMyChecklist(OWNER_ID);

        assertThat(result.items()).hasSize(2);
        assertThat(result.items().getFirst().appointments()).hasSize(1);
        assertThat(result.items().getFirst().appointments().getFirst().title()).isEqualTo("appointment");
        then(checklistAppointmentService).should().findAllByChecklistItemIdInOrderByCreatedAtAscIdAsc(
                List.of(incompleteItem.id(), completedItem.id())
        );
        then(checklistAppointmentService).shouldHaveNoMoreInteractions();
    }

    @Test
    @DisplayName("할 일 상태를 기준으로 체크리스트 진행도를 계산한다")
    void shouldCalculateChecklistProgressBasedOnChecklistItems() {
        Checklist checklist = new Checklist(
                CHECKLIST_ID,
                OWNER_ID,
                List.of(
                        constructTestItem(200L),
                        constructTestItem(201L, ChecklistItemStatus.DONE, null),
                        constructTestItem(202L, ChecklistItemStatus.DONE, CONTRACT_ITEM_ID)
                )
        );
        given(checklistRepository.getByOwnerId(OWNER_ID)).willReturn(checklist);

        ChecklistProgressResult result = checklistService.findMyChecklistProgress(OWNER_ID);

        assertThat(result)
                .extracting(
                        ChecklistProgressResult::totalCount,
                        ChecklistProgressResult::doneCount,
                        ChecklistProgressResult::remainingCount,
                        ChecklistProgressResult::percentage,
                        ChecklistProgressResult::allDone
                )
                .containsExactly(3, 2, 1, 67, false);
        then(checklistAppointmentService).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("일정이 필요한 할 일을 카테고리 이름과 함께 돌려준다")
    void shouldFindUnscheduledItemsWithCategoryName() {
        // given
        ChecklistItem customItem = constructTestItem(200L);
        ChecklistItem doneItem = constructTestItem(201L, ChecklistItemStatus.DONE, null);
        ChecklistItem catalogItem = constructTestItem(202L, ChecklistItemStatus.CONTINUE, CONTRACT_ITEM_ID);
        ChecklistItem scheduledItem = constructTestItem(203L);
        given(checklistRepository.getByOwnerId(OWNER_ID)).willReturn(new Checklist(
                CHECKLIST_ID,
                OWNER_ID,
                List.of(customItem, doneItem, catalogItem, scheduledItem)
        ));
        given(checklistAppointmentService.findAllByChecklistItemIds(List.of(200L, 202L, 203L)))
                .willReturn(List.of(appointmentOf(scheduledItem)));
        given(catalogService.findCategoryNames(Set.of(CATEGORY_ID)))
                .willReturn(new CategoryNames(Map.of(CATEGORY_ID, "웨딩홀")));
        given(shuffler.shuffle(List.of(customItem, catalogItem)))
                .willReturn(List.of(customItem, catalogItem));

        // when
        List<UnscheduledChecklistItemResult> results = checklistService.findUnscheduledItems(OWNER_ID, 4);

        // then
        assertThat(results).containsExactly(
                new UnscheduledChecklistItemResult(200L, "계약서 확인", "웨딩홀", ChecklistItemStatus.PREV),
                new UnscheduledChecklistItemResult(202L, "계약서 확인", "웨딩홀", ChecklistItemStatus.CONTINUE)
        );
    }

    @Test
    @DisplayName("일정이 필요한 할 일이 limit보다 많으면 섞은 순서에서 앞의 limit개만 돌려준다")
    void shouldReturnFirstItemsUpToLimitInShuffledOrder() {
        // given
        List<ChecklistItem> items = List.of(
                constructTestItem(200L),
                constructTestItem(201L),
                constructTestItem(202L),
                constructTestItem(203L),
                constructTestItem(204L),
                constructTestItem(205L)
        );
        given(checklistRepository.getByOwnerId(OWNER_ID)).willReturn(new Checklist(CHECKLIST_ID, OWNER_ID, items));
        given(catalogService.findCategoryNames(Set.of(CATEGORY_ID)))
                .willReturn(new CategoryNames(Map.of(CATEGORY_ID, "웨딩홀")));
        given(shuffler.shuffle(items)).willReturn(items.reversed());

        // when
        List<UnscheduledChecklistItemResult> results = checklistService.findUnscheduledItems(OWNER_ID, 3);

        // then
        assertThat(results)
                .extracting(UnscheduledChecklistItemResult::checklistItemId)
                .containsExactly(205L, 204L, 203L);
    }

    @Test
    @DisplayName("일정이 필요한 할 일이 없으면 빈 목록을 돌려준다")
    void shouldReturnEmptyWhenNoItemNeedsSchedule() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID)).willReturn(new Checklist(
                CHECKLIST_ID,
                OWNER_ID,
                List.of(constructTestItem(200L, ChecklistItemStatus.DONE, null))
        ));
        given(catalogService.findCategoryNames(Set.of()))
                .willReturn(new CategoryNames(Map.of()));

        // when
        List<UnscheduledChecklistItemResult> results = checklistService.findUnscheduledItems(OWNER_ID, 4);

        // then
        assertThat(results).isEmpty();
    }

    @Test
    @DisplayName("준비 목록에서 담은 할 일이 없으면 1단계 준비 항목을 추천한다")
    void shouldRecommendFirstPhaseItemsWhenNothingAddedFromCatalog() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID)).willReturn(new Checklist(
                CHECKLIST_ID,
                OWNER_ID,
                List.of(constructTestItem(200L))
        ));
        given(catalogService.findAllItemDetails()).willReturn(ALL_ITEM_DETAILS);
        given(shuffler.shuffle(anyList())).willAnswer(invocation -> invocation.getArgument(0));

        // when
        List<RecommendedCatalogItemResult> results = checklistService.findRecommendedCatalogItems(OWNER_ID, 20);

        // then
        assertThat(results)
                .extracting(RecommendedCatalogItemResult::catalogItemId)
                .containsExactlyInAnyOrder(HALL_TOUR.id(), HALL_CONTRACT.id(), STYLING_CONSULTING.id());
    }

    @Test
    @DisplayName("담은 준비 항목의 가장 큰 단계 이하에서 카테고리와 상관없이 담지 않은 항목을 추천한다")
    void shouldRecommendNotAddedItemsUpToMaxAddedPhaseAcrossCategories() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID)).willReturn(new Checklist(
                CHECKLIST_ID,
                OWNER_ID,
                List.of(
                        constructTestItem(200L, ChecklistItemStatus.DONE, HALL_TOUR.id()),
                        constructTestItem(201L, ChecklistItemStatus.PREV, DRESS_SHOP.id())
                )
        ));
        given(catalogService.findAllItemDetails()).willReturn(ALL_ITEM_DETAILS);
        given(shuffler.shuffle(anyList())).willAnswer(invocation -> invocation.getArgument(0));

        // when
        List<RecommendedCatalogItemResult> results = checklistService.findRecommendedCatalogItems(OWNER_ID, 20);

        // then
        assertThat(results)
                .extracting(RecommendedCatalogItemResult::catalogItemId)
                .containsExactlyInAnyOrder(HALL_CONTRACT.id(), CEREMONY_TYPE.id(), STYLING_CONSULTING.id());
    }

    @Test
    @DisplayName("기준 단계 이하의 준비 항목을 모두 담았으면 담지 않은 항목이 남은 다음 단계를 추천한다")
    void shouldRecommendNextPhaseItemsWhenAllItemsUpToBasePhaseAdded() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID)).willReturn(new Checklist(
                CHECKLIST_ID,
                OWNER_ID,
                List.of(
                        constructTestItem(200L, ChecklistItemStatus.PREV, HALL_TOUR.id()),
                        constructTestItem(201L, ChecklistItemStatus.PREV, HALL_CONTRACT.id()),
                        constructTestItem(202L, ChecklistItemStatus.PREV, STYLING_CONSULTING.id())
                )
        ));
        given(catalogService.findAllItemDetails()).willReturn(ALL_ITEM_DETAILS);
        given(shuffler.shuffle(anyList())).willAnswer(invocation -> invocation.getArgument(0));

        // when
        List<RecommendedCatalogItemResult> results = checklistService.findRecommendedCatalogItems(OWNER_ID, 20);

        // then
        assertThat(results)
                .extracting(RecommendedCatalogItemResult::catalogItemId)
                .containsExactlyInAnyOrder(CEREMONY_TYPE.id(), DRESS_SHOP.id());
    }

    @Test
    @DisplayName("준비 항목을 모두 담았으면 추천할 항목이 없다")
    void shouldReturnEmptyWhenAllCatalogItemsAdded() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID)).willReturn(new Checklist(
                CHECKLIST_ID,
                OWNER_ID,
                List.of(
                        constructTestItem(200L, ChecklistItemStatus.PREV, HALL_TOUR.id()),
                        constructTestItem(201L, ChecklistItemStatus.PREV, HALL_CONTRACT.id()),
                        constructTestItem(202L, ChecklistItemStatus.PREV, CEREMONY_TYPE.id()),
                        constructTestItem(203L, ChecklistItemStatus.PREV, HOST_BOOKING.id()),
                        constructTestItem(204L, ChecklistItemStatus.PREV, STYLING_CONSULTING.id()),
                        constructTestItem(205L, ChecklistItemStatus.PREV, DRESS_SHOP.id())
                )
        ));
        given(catalogService.findAllItemDetails()).willReturn(ALL_ITEM_DETAILS);
        given(shuffler.shuffle(anyList())).willAnswer(invocation -> invocation.getArgument(0));

        // when
        List<RecommendedCatalogItemResult> results = checklistService.findRecommendedCatalogItems(OWNER_ID, 20);

        // then
        assertThat(results).isEmpty();
    }

    @Test
    @DisplayName("추천 후보를 섞은 순서에서 앞의 limit개만 준비 항목 정보와 함께 돌려준다")
    void shouldReturnFirstRecommendedItemsUpToLimitInShuffledOrder() {
        // given
        given(checklistRepository.getByOwnerId(OWNER_ID)).willReturn(new Checklist(CHECKLIST_ID, OWNER_ID, List.of()));
        given(catalogService.findAllItemDetails()).willReturn(ALL_ITEM_DETAILS);
        given(shuffler.shuffle(List.of(HALL_TOUR, HALL_CONTRACT, STYLING_CONSULTING)))
                .willReturn(List.of(STYLING_CONSULTING, HALL_CONTRACT, HALL_TOUR));

        // when
        List<RecommendedCatalogItemResult> results = checklistService.findRecommendedCatalogItems(OWNER_ID, 2);

        // then
        assertThat(results).containsExactly(
                new RecommendedCatalogItemResult(39L, "스드메 상담", "스드메", 1, "스드메 패키지 계약"),
                new RecommendedCatalogItemResult(2L, "웨딩홀 계약", "웨딩홀", 1, "웨딩홀 정하기")
        );
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
        return new Checklist(CHECKLIST_ID, ownerId, List.of(constructTestItem(200L)));
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
                        CatalogItemAdditionResult.AddedChecklistItem::status
                )
                .containsExactly(
                        tuple(CONTRACT_ITEM_ID, CATEGORY_ID, ChecklistItemStatus.PREV),
                        tuple(ESTIMATE_ITEM_ID, CATEGORY_ID, ChecklistItemStatus.PREV)
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
                        ChecklistItemResult::status
                )
                .containsExactly(null, CATEGORY_ID, "청첩장 문구 정하기", ChecklistItemStatus.PREV);
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
        ChecklistItem item = constructTestItem(200L, ChecklistItemStatus.PREV, 100L);
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
        ChecklistItem item = constructTestItem(200L, ChecklistItemStatus.PREV, null);
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
        ChecklistItem item = constructTestItem(200L, ChecklistItemStatus.DONE, null);
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
        ChecklistItem item = constructTestItem(200L, ChecklistItemStatus.PREV, null);
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
                List.of(constructTestItem(100L), constructTestItem(101L))
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
        ChecklistItem item = constructTestItem(200L);
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
        ChecklistItem item = constructTestItem(200L);
        given(checklistRepository.getByChecklistItemId(item.id()))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID, List.of(item)));

        // when, then
        assertThatThrownBy(() -> checklistService.hasRemainingAppointments(OTHER_OWNER_ID, item.id()))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);
        then(checklistAppointmentService).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("할 일을 완료하면 남은 일정도 함께 완료한 뒤 할 일을 저장한다")
    void shouldCompleteRemainingAppointmentsBeforeSavingCompletedItem() {
        // given
        ChecklistItem item = constructTestItem(200L);
        given(checklistRepository.getByChecklistItemId(item.id()))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID, List.of(item)));
        given(checklistRepository.saveItem(any(Checklist.class), any(ChecklistItem.class)))
                .willAnswer(invocation -> invocation.getArgument(1));

        // when
        ChecklistItemResult result = checklistService.changeItemStatus(OWNER_ID, item.id(), "done");

        // then
        assertThat(result.status()).isEqualTo(ChecklistItemStatus.DONE);

        InOrder inOrder = inOrder(checklistAppointmentService, checklistRepository);
        inOrder.verify(checklistAppointmentService).completeAllByChecklistItemId(item.id());
        inOrder.verify(checklistRepository).saveItem(any(Checklist.class), any(ChecklistItem.class));
    }

    @Test
    @DisplayName("이미 완료한 할 일을 다시 완료해도 남은 일정은 함께 완료한다")
    void shouldCompleteRemainingAppointmentsWhenItemIsAlreadyDone() {
        // given
        ChecklistItem item = constructTestItem(200L, ChecklistItemStatus.DONE, null);
        given(checklistRepository.getByChecklistItemId(item.id()))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID, List.of(item)));
        given(checklistRepository.saveItem(any(Checklist.class), any(ChecklistItem.class)))
                .willAnswer(invocation -> invocation.getArgument(1));

        // when
        ChecklistItemResult result = checklistService.changeItemStatus(OWNER_ID, item.id(), "done");

        // then
        assertThat(result.status()).isEqualTo(ChecklistItemStatus.DONE);
        then(checklistAppointmentService).should().completeAllByChecklistItemId(item.id());
    }

    @Test
    @DisplayName("?쇱젙???꾨즺?섏뼱?룄 泥댄겕由ъ뒪????ぉ???꾨즺?섏? ?딆뒗??")
    void shouldNotCompleteChecklistItemWhenAppointmentIsCompleted() {
        ChecklistItem item = constructTestItem(200L);
        given(checklistRepository.getByChecklistItemId(item.id()))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID, List.of(item)));

        boolean checklistItemDone = checklistService.changeItemStatusByAppointment(
                OWNER_ID,
                item.id(),
                true
        );

        assertThat(checklistItemDone).isFalse();
        then(checklistRepository).should(never()).saveItem(any(Checklist.class), any(ChecklistItem.class));
    }

    @Test
    @DisplayName("?쇱젙???誘몄셿猷??섎㈃ ?꾨즺???곹깭??泥댄겕由ъ뒪????ぉ???誘몄셿猷뚮줈 蹂寃쏀븳??")
    void shouldReopenChecklistItemWhenAppointmentIsReopened() {
        ChecklistItem item = constructTestItem(200L, ChecklistItemStatus.DONE, null);
        Checklist checklist = new Checklist(CHECKLIST_ID, OWNER_ID, List.of(item));
        given(checklistRepository.getByChecklistItemId(item.id())).willReturn(checklist);
        given(checklistRepository.saveItem(any(Checklist.class), any(ChecklistItem.class)))
                .willAnswer(invocation -> invocation.getArgument(1));

        boolean checklistItemDone = checklistService.changeItemStatusByAppointment(
                OWNER_ID,
                item.id(),
                false
        );

        assertThat(checklistItemDone).isFalse();
        ArgumentCaptor<ChecklistItem> captor = ArgumentCaptor.forClass(ChecklistItem.class);
        then(checklistRepository).should().saveItem(any(Checklist.class), captor.capture());
        assertThat(captor.getValue().status()).isEqualTo(ChecklistItemStatus.CONTINUE);
    }

    @Test
    @DisplayName("할 일을 미완료 상태로 바꾸면 일정 되돌리기를 맡긴 뒤 할 일을 저장한다")
    void shouldReopenAppointmentsBeforeSavingReopenedItem() {
        // given
        ChecklistItem item = constructTestItem(200L, ChecklistItemStatus.DONE, null);
        given(checklistRepository.getByChecklistItemId(item.id()))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID, List.of(item)));
        given(checklistRepository.saveItem(any(Checklist.class), any(ChecklistItem.class)))
                .willAnswer(invocation -> invocation.getArgument(1));

        // when
        ChecklistItemResult result = checklistService.changeItemStatus(OWNER_ID, item.id(), "prev");

        // then
        assertThat(result.status()).isEqualTo(ChecklistItemStatus.PREV);

        InOrder inOrder = inOrder(checklistAppointmentService, checklistRepository);
        inOrder.verify(checklistAppointmentService)
                .reopenAllDoneByChecklistItemId(item.id());
        inOrder.verify(checklistRepository).saveItem(any(Checklist.class), any(ChecklistItem.class));
    }

    @Test
    @DisplayName("다른 사용자의 할 일은 완료할 수 없다")
    void shouldRejectCompletionForOtherUsersItem() {
        // given
        ChecklistItem item = constructTestItem(200L);
        given(checklistRepository.getByChecklistItemId(item.id()))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID, List.of(item)));

        // when, then
        assertThatThrownBy(() -> checklistService.changeItemStatus(OTHER_OWNER_ID, item.id(), "done"))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_ITEM_ACCESS_DENIED);
        then(checklistAppointmentService).shouldHaveNoInteractions();
        then(checklistRepository).should(never()).saveItem(any(Checklist.class), any(ChecklistItem.class));
    }

    @Test
    @DisplayName("일정 완료가 실패하면 할 일을 완료하지 않는다")
    void shouldNotCompleteItemWhenAppointmentCompletionFails() {
        // given
        ChecklistItem item = constructTestItem(200L);
        given(checklistRepository.getByChecklistItemId(item.id()))
                .willReturn(new Checklist(CHECKLIST_ID, OWNER_ID, List.of(item)));
        willThrow(new IllegalStateException("일정 완료 실패"))
                .given(checklistAppointmentService)
                .completeAllByChecklistItemId(item.id());

        // when, then
        assertThatThrownBy(() -> checklistService.changeItemStatus(OWNER_ID, item.id(), "done"))
                .isInstanceOf(IllegalStateException.class);
        then(checklistRepository).should(never()).saveItem(any(Checklist.class), any(ChecklistItem.class));
    }

    private static ChecklistItem constructTestItem(Long id) {
        return constructTestItem(id, ChecklistItemStatus.PREV, null);
    }

    private static ChecklistItem constructTestItem(
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

    private static Appointment appointmentOf(ChecklistItem item) {
        return new Appointment(
                null,
                item.id(),
                "웨딩홀 투어",
                java.time.LocalDate.of(2026, 10, 1),
                null,
                null,
                null,
                null,
                false,
                false
        );
    }
}
