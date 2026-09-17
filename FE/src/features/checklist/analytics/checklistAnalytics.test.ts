import { describe, expect, it } from "vitest";

import {
  createAppointmentCreateEvent,
  createChecklistTaskCategoryUpdateEvent,
  createChecklistTaskCompleteEvent,
  createChecklistTaskCreateEvent,
  createChecklistTaskTitleUpdateEvent,
  createPlannerAppointmentStartEvent,
} from "./checklistAnalytics";

describe("체크리스트와 일정 Analytics 이벤트", () => {
  it("직접 생성한 할 일의 공개 카테고리만 포함한다", () => {
    expect(createChecklistTaskCreateEvent("2")).toEqual({
      name: "checklist_task_create",
      parameters: { category_id: "2", source: "checklist" },
    });
  });

  it("완료 동작과 공개 카테고리만 포함한다", () => {
    expect(createChecklistTaskCompleteEvent("2")).toEqual({
      name: "checklist_task_complete",
      parameters: { action: "complete", category_id: "2" },
    });
  });

  it("제목 변경 이벤트에 제목이나 식별자를 포함하지 않는다", () => {
    expect(createChecklistTaskTitleUpdateEvent()).toEqual({
      name: "checklist_task_title_update",
      parameters: { source: "checklist" },
    });
  });

  it("카테고리 변경 이벤트에 대상 공개 카테고리만 포함한다", () => {
    expect(createChecklistTaskCategoryUpdateEvent("3")).toEqual({
      name: "checklist_task_category_update",
      parameters: { category_id: "3" },
    });
  });

  it("플래너의 일정 추가 진입 맥락만 포함한다", () => {
    expect(createPlannerAppointmentStartEvent()).toEqual({
      name: "planner_appointment_start",
      parameters: { entry_type: "unscheduled_task", source: "planner" },
    });
  });

  it.each(["checklist", "planner"] as const)(
    "%s 유입 일정 생성에 자유 형식 입력이나 식별자를 포함하지 않는다",
    (source) => {
      expect(createAppointmentCreateEvent(source)).toEqual({
        name: "appointment_create",
        parameters: { creation_type: "checklist_item", source },
      });
    },
  );
});
