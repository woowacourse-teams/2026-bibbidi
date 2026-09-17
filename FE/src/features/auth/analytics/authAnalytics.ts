import type { AnalyticsEvent } from "../../../infrastructure/analytics";

const SERVICE_AUTH_METHOD = "service";

export function createLoginEvent(): AnalyticsEvent {
  return {
    name: "login",
    parameters: {
      method: SERVICE_AUTH_METHOD,
    },
  };
}

export function createSignUpEvent(): AnalyticsEvent {
  return {
    name: "sign_up",
    parameters: {
      method: SERVICE_AUTH_METHOD,
    },
  };
}

export function createLogoutEvent(): AnalyticsEvent {
  return {
    name: "logout",
    parameters: {},
  };
}
