import type { AnalyticsEvent } from "../../../infrastructure/analytics";

export function createLogoutEvent(): AnalyticsEvent {
  return {
    name: "logout",
    parameters: {},
  };
}
