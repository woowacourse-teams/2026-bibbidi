package com.bibbidi.wedding.chat.tools.dto;

import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import java.util.List;

public record ChecklistToolResponse(
        boolean exists,
        List<ChecklistToolItemResponse> items
) {

    public static ChecklistToolResponse from(ChecklistWithAppointmentsResult result) {
        return new ChecklistToolResponse(
                true,
                result.items().stream().map(ChecklistToolItemResponse::from).toList()
        );
    }

    public static ChecklistToolResponse notFound() {
        return new ChecklistToolResponse(false, List.of());
    }
}
