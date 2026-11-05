import { describe, expect, it } from "vitest";

import type {
  ChecklistQueryItemModel,
  ChecklistQueryModel,
} from "../../checklist";
import { createCalendarPlanningModel } from "./calendarPlanning";

function item(
  id: number,
  overrides: Partial<ChecklistQueryItemModel> = {},
): ChecklistQueryItemModel {
  return {
    id: `checklist-item-${id}`,
    checklistItemId: id,
    sourceCatalogItemId: id,
    categoryId: "hall",
    title: `할 일 ${id}`,
    status: "prev",
    appointments: [],
    ...overrides,
  };
}

describe("createCalendarPlanningModel", () => {
  it("로드맵 할 일과 직접 만든 할 일을 함께 관리하며 완료·일정 보유 항목은 날짜 미정에서 제외한다", () => {
    const pending = item(1);
    const custom = item(2, { sourceCatalogItemId: null });
    const done = item(3, { status: "done" });
    const scheduled = item(4, {
      appointments: [
        {
          id: 40,
          title: "투어 예약",
          date: "2026-10-08",
          isDone: false,
          startTime: null,
          endTime: null,
          memo: "예약 확인",
          place: "웨딩홀",
        },
      ],
    });
    const checklist: ChecklistQueryModel = {
      categories: [
        {
          id: "hall",
          title: "웨딩홀",
          items: [],
          steps: [
            {
              id: "step",
              title: "투어",
              order: 1,
              items: [pending, done, scheduled],
            },
          ],
          customItems: [custom],
        },
      ],
    };
    const model = createCalendarPlanningModel(checklist);
    expect(model.undated.map((task) => task.id)).toEqual([
      pending.id,
      custom.id,
    ]);
    expect(model.undated.every((task) => task.category === "웨딩홀")).toBe(
      true,
    );
    expect([...model.addedCatalogItemIds]).toEqual([1, 3, 4]);
    expect(model.schedules).toEqual([
      {
        ...scheduled.appointments[0],
        checklistItemId: 4,
        taskTitle: scheduled.title,
      },
    ]);
  });
});
