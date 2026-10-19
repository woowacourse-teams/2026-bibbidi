package com.bibbidi.wedding.chat.adapter.checklist;

import com.bibbidi.wedding.chat.service.port.ChecklistLookupPort;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class ChecklistServiceAdapter implements ChecklistLookupPort {

    private final ChecklistService checklistService;

    public ChecklistServiceAdapter(ChecklistService checklistService) {
        this.checklistService = checklistService;
    }

    @Override
    public Optional<ChecklistWithAppointmentsResult> findMyChecklistIfPresent(Long userId) {
        return checklistService.findMyChecklistIfPresent(userId);
    }

    @Override
    public List<Long> filterRecommendableCatalogItemIds(Long userId, List<Long> catalogItemIds) {
        return checklistService.filterRecommendableCatalogItemIds(userId, catalogItemIds);
    }
}
