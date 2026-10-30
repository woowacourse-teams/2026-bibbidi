import type { AnalyticsEvent } from "../../../infrastructure/analytics";

export function createFeedbackSubmitEvent(
  source: "service_layout" | "ai_chat" = "service_layout",
): AnalyticsEvent {
  return {
    name: "feedback_submit",
    parameters: {
      source,
    },
  };
}
