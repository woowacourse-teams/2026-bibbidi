import type { AnalyticsEvent } from "../../../infrastructure/analytics";

export type AppointmentCreationSource = "checklist" | "planner";

export function createChecklistTaskCreateEvent(
  categoryId: string,
): AnalyticsEvent {
  return {
    name: "checklist_task_create",
    parameters: {
      category_id: categoryId,
      source: "checklist",
    },
  };
}

export function createChecklistTaskCompleteEvent(
  categoryId: string,
): AnalyticsEvent {
  return {
    name: "checklist_task_complete",
    parameters: {
      action: "complete",
      category_id: categoryId,
    },
  };
}

export function createChecklistTaskTitleUpdateEvent(): AnalyticsEvent {
  return {
    name: "checklist_task_title_update",
    parameters: {
      source: "checklist",
    },
  };
}

export function createChecklistTaskCategoryUpdateEvent(
  categoryId: string,
): AnalyticsEvent {
  return {
    name: "checklist_task_category_update",
    parameters: {
      category_id: categoryId,
    },
  };
}

export function createPlannerAppointmentStartEvent(): AnalyticsEvent {
  return {
    name: "planner_appointment_start",
    parameters: {
      entry_type: "unscheduled_task",
      source: "planner",
    },
  };
}

export function createAppointmentCreateEvent(
  source: AppointmentCreationSource,
): AnalyticsEvent {
  return {
    name: "appointment_create",
    parameters: {
      creation_type: "checklist_item",
      source,
    },
  };
}
