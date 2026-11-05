import * as Sentry from "@sentry/react";

import { analyticsPagePath } from "../analytics/posthogPrivacy";
import { safeSentryBreadcrumb, sanitizeSentryEvent } from "./sentryPrivacy";

type ErrorLevel = "fatal" | "error" | "warning";
type AuthState =
  | "loading"
  | "guest"
  | "onboardingRequired"
  | "accountSetupRequired"
  | "synchronizing"
  | "authenticated"
  | "error";

interface ErrorContext {
  authState: AuthState;
  pathname: string;
  userId?: number;
}

interface ReportOptions {
  feature: "app" | "auth" | "calendar" | "checklist";
  operation: string;
  failureKind?: string;
  level?: ErrorLevel;
}

let initialized = false;
let lastPagePath: string | null = null;

export function initializeErrorTracking(): void {
  if (initialized || !__BIBBIDI_SENTRY_ENABLED__ || !__BIBBIDI_SENTRY_DSN__)
    return;

  try {
    Sentry.init({
      dsn: __BIBBIDI_SENTRY_DSN__,
      environment: __BIBBIDI_APP_ENV__,
      release: __BIBBIDI_APP_VERSION__,
      maxBreadcrumbs: 20,
      beforeBreadcrumb: safeSentryBreadcrumb,
      beforeSend: sanitizeSentryEvent,
    });
    initialized = true;
  } catch {
    // 오류 추적 도구 장애가 제품 사용을 막지 않는다.
  }
}

export function setErrorContext(context: ErrorContext): void {
  if (!initialized) return;

  try {
    const pagePath = analyticsPagePath(context.pathname);
    Sentry.setTag("auth_state", context.authState);
    Sentry.setTag("page_path", pagePath ?? "unknown");
    Sentry.setUser(
      context.authState === "authenticated" &&
        Number.isSafeInteger(context.userId) &&
        (context.userId ?? 0) > 0
        ? { id: String(context.userId) }
        : null,
    );
    if (pagePath && pagePath !== lastPagePath) {
      Sentry.addBreadcrumb({
        category: "bibbidi.navigation",
        message: pagePath,
      });
    }
    lastPagePath = pagePath;
  } catch {
    // 문맥 갱신 실패는 화면 이동을 막지 않는다.
  }
}

export function clearErrorUser(): void {
  if (!initialized) return;
  try {
    Sentry.setUser(null);
  } catch {
    // 로그아웃을 막지 않는다.
  }
}

export function addErrorAction(action: string): void {
  if (!initialized || !/^[a-z]+(?:[._][a-z]+)*$/.test(action)) return;
  try {
    Sentry.addBreadcrumb({
      category: "bibbidi.action",
      message: action,
    });
  } catch {
    // 사용자 동작을 막지 않는다.
  }
}

export function reportHandledError(
  error: unknown,
  { feature, operation, failureKind, level = "error" }: ReportOptions,
): void {
  if (!initialized) return;

  try {
    Sentry.withScope((scope) => {
      scope.setLevel(level);
      scope.setTag("feature", feature);
      scope.setTag("operation", operation);
      if (failureKind) scope.setTag("failure_kind", failureKind);
      Sentry.captureException(
        error instanceof Error ? error : new Error("Unexpected error"),
      );
    });
  } catch {
    // 오류 보고 실패가 기존 오류 처리 흐름을 바꾸지 않는다.
  }
}
