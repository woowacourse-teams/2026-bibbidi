package com.bibbidi.wedding.checklist.controller.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record AddCatalogItemsRequest(
        @NotEmpty(message = "추가할 준비 항목을 하나 이상 선택해야 합니다.")
        List<@NotNull(message = "준비 항목 ID는 비어 있을 수 없습니다.") Long> catalogItemIds
) {
}
