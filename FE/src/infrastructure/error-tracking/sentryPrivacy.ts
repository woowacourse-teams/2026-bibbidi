import type { Breadcrumb, ErrorEvent } from "@sentry/react";

import { analyticsPagePath } from "../analytics/posthogPrivacy";

const SAFE_BREADCRUMB_CATEGORIES = new Set([
  "bibbidi.navigation",
  "bibbidi.action",
]);
const SAFE_TAG_KEYS = new Set([
  "auth_state",
  "feature",
  "operation",
  "failure_kind",
  "page_path",
]);

function stripQueryAndHash(value: string | undefined): string | undefined {
  return value?.split(/[?#]/, 1)[0];
}

function safeExceptionType(value: string | undefined): string {
  return value && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value) ? value : "Error";
}

function safeDebugMeta(
  debugMeta: ErrorEvent["debug_meta"],
): ErrorEvent["debug_meta"] {
  const images = debugMeta?.images
    ?.filter(
      (image) =>
        image.type === "sourcemap" &&
        /^[0-9a-f-]{32,36}$/i.test(image.debug_id),
    )
    .map((image) => ({
      type: "sourcemap" as const,
      debug_id: image.debug_id,
      code_file: stripQueryAndHash(image.code_file) ?? "",
    }));
  return images?.length ? { images } : undefined;
}

export function safeSentryBreadcrumb(
  breadcrumb: Breadcrumb,
): Breadcrumb | null {
  if (
    !breadcrumb.category ||
    !SAFE_BREADCRUMB_CATEGORIES.has(breadcrumb.category)
  )
    return null;

  if (
    breadcrumb.category === "bibbidi.navigation" &&
    (!breadcrumb.message || !analyticsPagePath(breadcrumb.message))
  )
    return null;

  if (
    breadcrumb.category === "bibbidi.action" &&
    !/^[a-z]+(?:[._][a-z]+)*$/.test(breadcrumb.message ?? "")
  )
    return null;

  return {
    category: breadcrumb.category,
    level: breadcrumb.level,
    message: breadcrumb.message,
    timestamp: breadcrumb.timestamp,
  };
}

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent | null {
  if (!event.exception?.values?.length) return null;

  const id = event.user?.id;
  const user =
    typeof id === "string" && /^[1-9]\d{0,15}$/.test(id) ? { id } : undefined;
  const tags = Object.fromEntries(
    Object.entries(event.tags ?? {}).filter(
      ([key, value]) =>
        SAFE_TAG_KEYS.has(key) &&
        typeof value === "string" &&
        /^[a-z0-9_./-]{1,64}$/.test(value) &&
        (key !== "page_path" || analyticsPagePath(value) === value),
    ),
  );

  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.exception.values.some(
      (value) => value.mechanism?.handled === false,
    )
      ? "fatal"
      : event.level,
    environment: event.environment,
    release: event.release,
    sdk: event.sdk,
    debug_meta: safeDebugMeta(event.debug_meta),
    user,
    tags,
    breadcrumbs: event.breadcrumbs
      ?.map(safeSentryBreadcrumb)
      .filter((value): value is Breadcrumb => value !== null),
    exception: {
      values: event.exception.values.map((value) => ({
        type: safeExceptionType(value.type),
        value: safeExceptionType(value.type),
        mechanism: value.mechanism
          ? {
              type: "generic",
              handled: value.mechanism.handled,
            }
          : undefined,
        stacktrace: value.stacktrace
          ? {
              frames: value.stacktrace.frames?.map((frame) => ({
                filename: stripQueryAndHash(frame.filename),
                abs_path: stripQueryAndHash(frame.abs_path),
                function: frame.function,
                module: frame.module,
                lineno: frame.lineno,
                colno: frame.colno,
                in_app: frame.in_app,
              })),
            }
          : undefined,
      })),
    },
  };
}
