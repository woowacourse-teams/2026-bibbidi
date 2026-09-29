import type { CaptureResult, PostHogConfig } from "posthog-js";

// 경로에 개인 식별자나 OAuth 결과를 넣지 않는다. 새 화면은 검토 후 추가한다.
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/planner",
  "/checklist",
  "/onboarding",
  "/onboarding/account",
]);

export function analyticsPagePath(pathname: string): string | null {
  const path = pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
  return PUBLIC_PATHS.has(path) ? path : null;
}

export function sanitizeAnalyticsUrl(value: string): string {
  try {
    const url = new URL(value);
    const path = analyticsPagePath(url.pathname);
    return path && ["https:", "http:"].includes(url.protocol)
      ? `${url.origin}${path}`
      : "";
  } catch {
    return "";
  }
}

const ALLOWED_PROPERTIES = new Set([
  "token",
  "distinct_id",
  "$device_id",
  "$anon_distinct_id",
  "$user_id",
  "$session_id",
  "$window_id",
  "$time",
  "$lib",
  "$lib_version",
  "$insert_id",
  "$is_identified",
  "$process_person_profile",
  "$browser",
  "$browser_version",
  "$os",
  "$os_version",
  "$device_type",
  "$screen_height",
  "$screen_width",
  "$viewport_height",
  "$viewport_width",
  "$snapshot_data",
  "$snapshot_bytes",
  "$snapshot_host",
  "environment",
  "app_version",
  "auth_state",
  "page_path",
  "page_title",
  "screen_name",
  "source",
  "category_id",
  "category_name",
  "phase",
  "previous_category_id",
  "initial_category_id",
  "step_id",
  "step_order",
  "item_count",
  "item_id",
  "direction",
  "input_method",
  "action",
  "entry_type",
  "creation_type",
  "provider",
  "failure_kind",
  "terms_required",
  "choice",
  "outcome",
]);

export function sanitizePostHogEvent(
  event: CaptureResult | null,
): CaptureResult | null {
  if (!event) return null;
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event.properties)) {
    if (ALLOWED_PROPERTIES.has(key)) properties[key] = value;
    if (
      ["$current_url", "page_location", "page_referrer"].includes(key) &&
      typeof value === "string"
    ) {
      properties[key] = sanitizeAnalyticsUrl(value);
    }
  }
  // SDK가 붙인 초기 유입 URL과 자동 Person 속성도 제거한다.
  return {
    uuid: event.uuid,
    event: event.event,
    timestamp: event.timestamp,
    properties,
  };
}

export const PRIVATE_REPLAY_CONFIG: PostHogConfig["session_recording"] = {
  maskAllInputs: true,
  maskTextSelector: "*",
  blockSelector: "img, svg, video, audio, iframe, canvas, .ph-no-capture",
  maskAttributeFn: (name, value) =>
    // _cssText는 rrweb이 생성한 스타일시트이며 사용자가 입력하는 DOM 속성이 아니다.
    ["class", "type", "role", "_cssText"].includes(name) ? value : "[masked]",
  maskCapturedNetworkRequestFn: (request) => {
    // method가 없는 rrweb 페이지 URL도 이 콜백을 거친다. 네트워크 요청은 기록하지 않는다.
    if (request.method) return null;
    const name = sanitizeAnalyticsUrl(request.name);
    return name ? { ...request, name } : null;
  },
  recordHeaders: false,
  recordBody: false,
  streamNetworkBody: false,
  captureJsonLd: false,
  captureCanvas: { recordCanvas: false },
  recordCrossOriginIframes: false,
  collectFonts: false,
};
