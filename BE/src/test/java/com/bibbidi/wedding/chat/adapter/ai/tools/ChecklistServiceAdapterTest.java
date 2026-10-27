package com.bibbidi.wedding.chat.adapter.ai.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.chat.service.dto.checklist.ChecklistSnapshot;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.repository.AppointmentRepository;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.checklist.service.ChecklistAppointmentService;
import com.bibbidi.wedding.checklist.service.ChecklistService;
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
                keepOrder));
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
    @DisplayName("호출한 사용자 정보가 없으면 아무것도 조회하지 않고 실패한다")
    void toolFailsWithoutLookingUpAnythingWhenTheCallingUserIsUnknown() {
        ToolContext withoutUser = new ToolContext(Map.of());

        assertThatThrownBy(() -> adapter.getMyChecklist(withoutUser)).isInstanceOf(BusinessException.class);
        verifyNoInteractions(catalogRepository, checklistRepository);
    }

    private static ToolContext toolContextOf(Long userId) {
        return new ToolContext(Map.of("userId", userId));
    }
}
