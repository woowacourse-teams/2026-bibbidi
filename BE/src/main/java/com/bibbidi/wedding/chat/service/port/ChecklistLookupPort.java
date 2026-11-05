package com.bibbidi.wedding.chat.service.port;

import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import java.util.List;
import java.util.Optional;

public interface ChecklistLookupPort {

    Optional<ChecklistWithAppointmentsResult> findMyChecklistIfPresent(Long userId);

    List<Long> filterRecommendableCatalogItemIds(Long userId, List<Long> catalogItemIds);
}
