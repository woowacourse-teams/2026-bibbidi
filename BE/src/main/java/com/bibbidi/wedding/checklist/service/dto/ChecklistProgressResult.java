package com.bibbidi.wedding.checklist.service.dto;

import com.bibbidi.wedding.checklist.domain.ChecklistProgress;

public record ChecklistProgressResult(
        int totalCount,
        int doneCount,
        int remainingCount,
        int percentage,
        boolean allDone
) {

    public static ChecklistProgressResult from(ChecklistProgress progress) {
        return new ChecklistProgressResult(
                progress.totalCount(),
                progress.doneCount(),
                progress.remainingCount(),
                progress.percentage(),
                progress.allDone()
        );
    }
}
