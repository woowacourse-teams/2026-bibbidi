package com.bibbidi.wedding.checklist.domain;

public record ChecklistProgress(int totalCount, int doneCount) {

    public int remainingCount() {
        return totalCount - doneCount;
    }

    public int percentage() {
        if (totalCount == 0) {
            return 0;
        }
        return Math.round((float) doneCount * 100 / totalCount);
    }

    public boolean allDone() {
        return totalCount > 0 && doneCount == totalCount;
    }
}
