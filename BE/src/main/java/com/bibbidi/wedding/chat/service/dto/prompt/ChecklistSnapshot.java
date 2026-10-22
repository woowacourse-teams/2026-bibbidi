package com.bibbidi.wedding.chat.service.dto.prompt;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public record ChecklistSnapshot(
        boolean exists,
        List<ChecklistItemSnapshot> items
) {

    public static ChecklistSnapshot from(ChecklistWithAppointmentsResult result) {
        return new ChecklistSnapshot(true, result.items().stream().map(ChecklistItemSnapshot::from).toList());
    }

    public static ChecklistSnapshot of(Optional<ChecklistWithAppointmentsResult> result) {
        return result.map(ChecklistSnapshot::from).orElseGet(ChecklistSnapshot::notFound);
    }

    public static ChecklistSnapshot notFound() {
        return new ChecklistSnapshot(false, List.of());
    }

    /**
     * 카탈로그 순서를 유지하면서, 이미 체크리스트에 등록한 항목을 뺀 추천 가능한 항목 ID를 돌려준다.
     */
    public List<Long> recommendableItemIds(List<CatalogItemDetailSnapshot> catalog) {
        Set<Long> addedIds = new HashSet<>();
        items.forEach(item -> addedIds.add(item.catalogItemId()));
        return catalog.stream()
                .map(CatalogItemDetailSnapshot::id)
                .filter(id -> !addedIds.contains(id))
                .toList();
    }
}
