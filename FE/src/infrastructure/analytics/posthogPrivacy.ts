import type { CaptureResult, PostHogConfig } from "posthog-js";

// 경로에 개인 식별자나 OAuth 결과를 넣지 않는다. 새 화면은 검토 후 추가한다.
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/calendar",
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

// 홍보 유입 분석용 값이다. 전체 URL과 referrer 원문 대신 캠페인 값과 유입 도메인만 남긴다.
const CAMPAIGN_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

const ATTRIBUTION_PROPERTIES = new Set([
  ...CAMPAIGN_KEYS,
  ...CAMPAIGN_KEYS.map((key) => `$session_entry_${key}`),
  "$referring_domain",
  "$session_entry_referring_domain",
  "$host",
  "$session_entry_host",
]);

// Web analytics의 경로 표는 이 속성으로 집계한다. 공개 경로만 남기고 콜백 경로는 버린다.
const PATH_PROPERTIES = new Set(["$pathname", "$session_entry_pathname"]);

const INITIAL_PERSON_PROPERTIES = new Set([
  ...CAMPAIGN_KEYS.map((key) => `$initial_${key}`),
  "$initial_referring_domain",
]);

export function sanitizePostHogEvent(
  event: CaptureResult | null,
): CaptureResult | null {
  if (!event) return null;
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event.properties)) {
    if (ALLOWED_PROPERTIES.has(key) || ATTRIBUTION_PROPERTIES.has(key))
      properties[key] = value;
    if (PATH_PROPERTIES.has(key) && typeof value === "string") {
      const path = analyticsPagePath(value);
      if (path) properties[key] = path;
    }
    if (
      ["$current_url", "page_location", "page_referrer"].includes(key) &&
      typeof value === "string"
    ) {
      properties[key] = sanitizeAnalyticsUrl(value);
    }
  }
  // Person에는 첫 유입 캠페인과 도메인만 남기고 초기 URL·referrer 원문은 제거한다.
  const initialAttribution = Object.fromEntries(
    Object.entries(event.$set_once ?? {}).filter(([key]) =>
      INITIAL_PERSON_PROPERTIES.has(key),
    ),
  );
  return {
    uuid: event.uuid,
    event: event.event,
    timestamp: event.timestamp,
    properties,
    ...(Object.keys(initialAttribution).length
      ? { $set_once: initialAttribution }
      : {}),
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
