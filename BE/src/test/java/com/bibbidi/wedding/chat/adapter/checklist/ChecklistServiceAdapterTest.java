package com.bibbidi.wedding.chat.adapter.checklist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.repository.AppointmentRepository;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.checklist.service.ChecklistAppointmentService;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import com.bibbidi.wedding.checklist.util.Shuffler;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

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
        adapter = new ChecklistServiceAdapter(new ChecklistService(
                checklistRepository,
                new CatalogService(catalogRepository),
                new ChecklistAppointmentService(mock(AppointmentRepository.class)),
                keepOrder));
    }

    @Test
    @DisplayName("사용자의 체크리스트가 있으면 조회해서 돌려준다")
    void findsTheUsersChecklist() {
        // given
        when(checklistRepository.getByOwnerId(USER_ID)).thenReturn(new Checklist(10L, USER_ID, List.of()));

        // when
        Optional<ChecklistWithAppointmentsResult> checklist = adapter.findMyChecklistIfPresent(USER_ID);

        // then
        assertThat(checklist).contains(new ChecklistWithAppointmentsResult(10L, List.of()));
    }

    @Test
    @DisplayName("사용자의 체크리스트가 없으면 빈 값을 돌려준다")
    void returnsEmptyWhenTheUserHasNoChecklist() {
        // given
        when(checklistRepository.getByOwnerId(USER_ID))
                .thenThrow(new BusinessException(ClientError.CHECKLIST_NOT_FOUND, "체크리스트가 없습니다."));

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
}
