import type { AnalyticsEvent } from "../../../infrastructure/analytics";

export function createFeedbackSubmitEvent(): AnalyticsEvent {
  return {
    name: "feedback_submit",
    parameters: {
      source: "service_layout",
    },
  };
}
