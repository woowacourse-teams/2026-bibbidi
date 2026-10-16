import type { AnalyticsEvent } from "../../../infrastructure/analytics";
import {
  SocialLoginApiError,
  SocialLoginNetworkError,
  SocialLoginTimeoutError,
} from "../api/socialLogin";

export function socialLoginFailureKind(error: unknown): string {
  if (error instanceof SocialLoginNetworkError) return "network";
  if (error instanceof SocialLoginTimeoutError) return "timeout";
  if (error instanceof SocialLoginApiError)
    return error.errorCode === 208 ? "state_invalid_or_expired" : "api";
  return "unknown";
}

export function createSocialLoginEvent(
  name:
    | "social_login_start"
    | "social_login_start_failed"
    | "social_login_callback_failed"
    | "social_login_callback_complete",
  provider: string,
  parameters: { failure_kind?: string; terms_required?: boolean } = {},
): AnalyticsEvent {
  return {
    name,
    parameters: {
      provider: ["kakao", "google"].includes(provider) ? provider : "unknown",
      ...parameters,
    },
  };
}
