import { describe, expect, it } from "vitest";

import { calculateChecklistProgress, ChecklistTaskModel } from "./checklist";

function createTask(
  id: string,
  status: ChecklistTaskModel["status"],
): ChecklistTaskModel {
  return {
    id,
    title: `할 일 ${id}`,
    schedule: "일정 없음",
    status,
  };
}

describe("calculateChecklistProgress", () => {
  it("할 일이 없으면 진행률을 0으로 계산한다", () => {
    expect(calculateChecklistProgress([])).toBe(0);
  });

  it("완료한 할 일의 비율을 반올림해 계산한다", () => {
    const tasks = [
      createTask("1", "complete"),
      createTask("2", "in-progress"),
      createTask("3", "incomplete"),
    ];

    expect(calculateChecklistProgress(tasks)).toBe(33);
  });

  it("모든 할 일이 완료되면 진행률을 100으로 계산한다", () => {
    const tasks = [createTask("1", "complete"), createTask("2", "complete")];

    expect(calculateChecklistProgress(tasks)).toBe(100);
  });
});
