package com.bibbidi.wedding.checklist.controller.dto;

import com.bibbidi.wedding.checklist.service.dto.ChecklistProgressResult;

public record ChecklistProgressResponse(
        int totalCount,
        int doneCount,
        int remainingCount,
        int percentage,
        boolean allDone
) {

    public static ChecklistProgressResponse from(ChecklistProgressResult result) {
        return new ChecklistProgressResponse(
                result.totalCount(),
                result.doneCount(),
                result.remainingCount(),
                result.percentage(),
                result.allDone()
        );
    }
}
