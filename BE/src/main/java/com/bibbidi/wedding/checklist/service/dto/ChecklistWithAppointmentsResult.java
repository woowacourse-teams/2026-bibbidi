package com.bibbidi.wedding.checklist.service.dto;

import java.util.List;

public record ChecklistWithAppointmentsResult(Long id, List<ChecklistItemWithAppointmentsResult> items) {
}
