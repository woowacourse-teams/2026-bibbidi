package com.bibbidi.wedding.chat.adapter.ai.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.service.dto.prompt.ChecklistSnapshot;
import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.repository.AppointmentRepository;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.checklist.service.ChecklistAppointmentService;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import com.bibbidi.wedding.checklist.util.Shuffler;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;

class ChecklistServiceAdapterTest {

    private static final Long USER_ID = 7L;

    private ChecklistRepository checklistRepository;
    private CatalogRepository catalogRepository;
    private ChecklistServiceAdapter adapter;

    @BeforeEach
    void setUp() {
        checklistRepository = mock(ChecklistRepository.class);
        catalogRepository = mock(CatalogRepository.class);
        Shuffler keepOrder = new Shuffler() {
            @Override
            public <T> List<T> shuffle(List<T> values) {
                return values;
            }
        };
        CatalogService catalogService = new CatalogService(catalogRepository);
        adapter = new ChecklistServiceAdapter(new ChecklistService(
                checklistRepository,
                catalogService,
                new ChecklistAppointmentService(mock(AppointmentRepository.class)),
                keepOrder), catalogService);
    }

    @Test
    @DisplayName("사용자의 체크리스트가 있으면 조회해서 돌려준다")
    void findsTheUsersChecklist() {
        // given
        when(checklistRepository.findByOwnerId(USER_ID)).thenReturn(
                Optional.of(new Checklist(10L, USER_ID, List.of())));

        // when
        Optional<ChecklistWithAppointmentsResult> checklist = adapter.findMyChecklistIfPresent(USER_ID);

        // then
        assertThat(checklist).contains(new ChecklistWithAppointmentsResult(10L, List.of()));
    }

    @Test
    @DisplayName("사용자의 체크리스트가 없으면 빈 값을 돌려준다")
    void returnsEmptyWhenTheUserHasNoChecklist() {
        // given
        when(checklistRepository.findByOwnerId(USER_ID)).thenReturn(Optional.empty());

        // when
        Optional<ChecklistWithAppointmentsResult> checklist = adapter.findMyChecklistIfPresent(USER_ID);

        // then
        assertThat(checklist).isEmpty();
    }

    @Test
    @DisplayName("추천 후보가 없으면 카탈로그를 조회하지 않고 빈 목록을 돌려준다")
    void returnsEmptyWithoutLookingUpTheCatalogWhenThereAreNoCandidates() {
        // when
        List<Long> recommendable = adapter.filterRecommendableCatalogItemIds(USER_ID, List.of());

        // then
        assertThat(recommendable).isEmpty();
        verifyNoInteractions(catalogRepository, checklistRepository);
    }

    @Test
    @DisplayName("도구를 호출한 사용자의 체크리스트를 돌려준다")
    void toolReturnsTheChecklistOfTheCallingUser() {
        // given
        when(checklistRepository.findByOwnerId(USER_ID)).thenReturn(
                Optional.of(new Checklist(10L, USER_ID, List.of())));

        // when
        ChecklistSnapshot checklist = adapter.getMyChecklist(toolContextOf(USER_ID));

        // then
        assertThat(checklist).isEqualTo(new ChecklistSnapshot(true, List.of()));
    }

    @Test
    @DisplayName("도구를 호출한 사용자의 체크리스트가 없으면 없는 상태로 돌려준다")
    void toolReportsAMissingChecklist() {
        // given
        when(checklistRepository.findByOwnerId(USER_ID)).thenReturn(Optional.empty());

        // when, then
        assertThat(adapter.getMyChecklist(toolContextOf(USER_ID))).isEqualTo(ChecklistSnapshot.notFound());
    }

    @Test
    @DisplayName("도구는 카탈로그 전체 중 호출한 사용자가 추천받을 수 있는 항목 ID만 돌려준다")
    void toolReturnsTheRecommendableItemIdsOfTheCallingUser() {
        // given
        ChecklistService checklistService = mock(ChecklistService.class);
        CatalogService catalogService = mock(CatalogService.class);
        when(catalogService.findAllItemDetails()).thenReturn(List.of(
                new CatalogItemDetailSnapshot(1L, "웨딩홀 후보 정하기", "웨딩홀", 1, "후보"),
                new CatalogItemDetailSnapshot(2L, "스튜디오 후보 정하기", "촬영", 1, "후보"),
                new CatalogItemDetailSnapshot(3L, "드레스 후보 정하기", "드레스", 1, "후보")));
        when(checklistService.filterRecommendableCatalogItemIds(USER_ID, List.of(1L, 2L, 3L)))
                .thenReturn(List.of(1L, 3L));
        ChecklistServiceAdapter toolAdapter = new ChecklistServiceAdapter(checklistService, catalogService);

        // when, then
        assertThat(toolAdapter.getRecommendableItemIds(toolContextOf(USER_ID))).containsExactly(1L, 3L);
    }

    @Test
    @DisplayName("호출한 사용자 정보가 없으면 아무것도 조회하지 않고 실패한다")
    void toolFailsWithoutLookingUpAnythingWhenTheCallingUserIsUnknown() {
        ToolContext withoutUser = new ToolContext(Map.of());

        assertThatThrownBy(() -> adapter.getMyChecklist(withoutUser)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> adapter.getRecommendableItemIds(withoutUser))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(catalogRepository, checklistRepository);
    }

    private static ToolContext toolContextOf(Long userId) {
        return new ToolContext(Map.of("userId", userId));
    }
}
