package com.bibbidi.wedding.chat.adapter.checklist;

import com.bibbidi.wedding.chat.service.port.ChecklistLookupPort;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
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
        try {
            return Optional.of(checklistService.findMyChecklist(userId));
        } catch (BusinessException exception) {
            if (exception.clientError() == ClientError.CHECKLIST_NOT_FOUND) {
                return Optional.empty();
            }
            throw exception;
        }
    }

    @Override
    public List<Long> filterRecommendableCatalogItemIds(Long userId, List<Long> catalogItemIds) {
        return checklistService.filterRecommendableCatalogItemIds(userId, catalogItemIds);
    }
}
