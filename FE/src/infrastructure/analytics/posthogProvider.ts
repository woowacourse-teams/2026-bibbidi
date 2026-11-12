import posthog, { type PostHog } from "posthog-js";

import type {
  AnalyticsContext,
  AnalyticsEvent,
  AnalyticsProvider,
} from "./analytics";
import {
  analyticsPagePath,
  PRIVATE_REPLAY_CONFIG,
  sanitizePostHogEvent,
  webVitalsProperties,
} from "./posthogPrivacy";

interface PostHogOptions {
  enabled: boolean;
  token: string;
  host: string;
  environment: string;
  appVersion: string;
}

type PostHogSdk = Pick<
  PostHog,
  | "init"
  | "capture"
  | "identify"
  | "reset"
  | "get_distinct_id"
  | "register"
  | "startSessionRecording"
  | "stopSessionRecording"
>;
const MEMBER_PREFIX = "bibbidi:user:";
// CloudFront 함수(bibbidi-internal-traffic-cookie)가 캠퍼스 IP 응답에 붙이는 쿠키
const INTERNAL_TRAFFIC_COOKIE = "bibbidi_internal=1";

const isInternalTraffic = () =>
  document.cookie.split("; ").includes(INTERNAL_TRAFFIC_COOKIE);

export function createPostHogProvider(
  options: PostHogOptions,
  sdk: PostHogSdk = posthog,
): AnalyticsProvider & {
  trackPerformance: (event: AnalyticsEvent) => void;
} {
  let initialized = false;
  let recording = false;
  let identityReady = false;
  let context: AnalyticsContext = { authState: "loading", pathname: "/" };
  let initialPath: string | null = null;
  let initialUrl = "";
  let routeLeftAt = Infinity;
  const pageLoadId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pendingPerformance: {
    name: string;
    properties: Record<string, unknown>;
  }[] = [];

  const stopRecording = () => {
    if (recording) sdk.stopSessionRecording();
    recording = false;
  };
  const reset = () => {
    identityReady = false;
    if (!initialized) return;
    stopRecording();
    sdk.reset(true);
  };
  const ensureAnonymous = () => {
    if (sdk.get_distinct_id()?.startsWith(MEMBER_PREFIX)) reset();
  };
  const isSettled = () =>
    ["guest", "onboardingRequired", "authenticated"].includes(
      context.authState,
    );
  const capturePerformance = (
    name: string,
    properties: Record<string, unknown>,
  ) => {
    if (!initialized) return;
    if (!identityReady || !isSettled()) {
      // 인증 확인이 길어져도 대기 이벤트를 무제한 보관하지 않는다.
      if (pendingPerformance.length < 20)
        pendingPerformance.push({ name, properties });
      return;
    }
    sdk.capture(name, properties);
  };

  return {
    initialize() {
      if (
        initialized ||
        !options.enabled ||
        !options.token ||
        isInternalTraffic()
      )
        return;
      initialPath = analyticsPagePath(window.location.pathname);
      initialUrl = initialPath ? `${window.location.origin}${initialPath}` : "";
      sdk.init(options.token, {
        api_host: options.host,
        ui_host: options.host.includes("eu.")
          ? "https://eu.posthog.com"
          : "https://us.posthog.com",
        defaults: "2026-08-30",
        strict_script_versioning: true,
        persistence: "localStorage",
        person_profiles: "always",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_performance: {
          web_vitals: true,
          web_vitals_allowed_metrics: ["FCP", "LCP"],
          web_vitals_attribution: false,
          network_timing: false,
          __preview_web_vitals_soft_navs: false,
        },
        capture_exceptions: false,
        enable_recording_console_log: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_conversations: true,
        disable_web_experiments: true,
        advanced_disable_feature_flags: true,
        save_referrer: true,
        save_campaign_params: true,
        disable_capture_url_hashes: true,
        respect_dnt: true,
        session_recording: PRIVATE_REPLAY_CONFIG,
        before_send: (event) => {
          if (event?.event === "$web_vitals") {
            if (!initialPath) return null;
            const metrics = webVitalsProperties(event.properties, routeLeftAt);
            if (!Object.keys(metrics).length) return null;
            const properties = {
              ...metrics,
              page_path: initialPath,
              $current_url: initialUrl,
              $pathname: initialPath,
              page_load_id: pageLoadId,
              navigation_kind: "document",
              auth_state: event.properties.auth_state ?? context.authState,
              environment: options.environment,
              app_version: options.appVersion,
            };
            if (!identityReady || !isSettled()) {
              capturePerformance("$web_vitals", properties);
              return null;
            }
            const otherProperties = Object.fromEntries(
              Object.entries(event.properties).filter(
                ([key]) => !key.startsWith("$web_vitals_"),
              ),
            );
            return sanitizePostHogEvent({
              ...event,
              properties: { ...otherProperties, ...properties },
            });
          }
          if (
            event?.event === "$snapshot" &&
            (!identityReady ||
              !isSettled() ||
              !analyticsPagePath(window.location.pathname))
          )
            return null;
          return sanitizePostHogEvent(event);
        },
      });
      // $identify 같은 SDK 이벤트에도 붙여 테스트 서버 기록을 환경으로 걸러낸다.
      sdk.register({
        environment: options.environment,
        app_version: options.appVersion,
      });
      initialized = true;
    },
    setContext(nextContext) {
      if (
        initialPath &&
        analyticsPagePath(nextContext.pathname) !== initialPath
      ) {
        routeLeftAt = Math.min(routeLeftAt, performance.now());
      }
      identityReady = false;
      context = nextContext;
      if (!initialized) return;
      if (!isSettled()) {
        stopRecording();
        return;
      }
      if (context.authState === "authenticated") {
        if (
          !Number.isSafeInteger(context.userId) ||
          (context.userId ?? 0) <= 0
        ) {
          stopRecording();
          return;
        }
        const memberId = `${MEMBER_PREFIX}${context.userId}`;
        const previousId = sdk.get_distinct_id();
        if (previousId?.startsWith(MEMBER_PREFIX) && previousId !== memberId)
          reset();
        if (sdk.get_distinct_id() !== memberId) sdk.identify(memberId);
      } else {
        ensureAnonymous();
      }
      identityReady = true;
      for (const event of pendingPerformance.splice(0)) {
        try {
          sdk.capture(event.name, event.properties);
        } catch {
          // 한 건의 SDK 오류가 나머지 전송과 리플레이 설정을 중단하지 않는다.
        }
      }
      if (!analyticsPagePath(context.pathname)) stopRecording();
      else if (!recording) {
        sdk.startSessionRecording();
        recording = true;
      }
    },
    track(event) {
      if (!initialized) return;
      const isCallbackEvent = event.name.startsWith("social_login_callback_");
      if (isCallbackEvent) {
        ensureAnonymous();
      } else if (
        !identityReady ||
        !isSettled() ||
        !analyticsPagePath(context.pathname)
      ) {
        return;
      }
      if (
        context.authState === "authenticated" &&
        (!Number.isSafeInteger(context.userId) || (context.userId ?? 0) <= 0)
      )
        return;
      const properties = {
        ...event.parameters,
        auth_state: isCallbackEvent ? "anonymous_callback" : context.authState,
        ...(event.name === "page_view"
          ? { $current_url: event.parameters.page_location }
          : {}),
      };
      sdk.capture(
        event.name === "page_view" ? "$pageview" : event.name,
        properties,
      );
      if (event.name === "page_view" && !recording) {
        sdk.startSessionRecording();
        recording = true;
      }
    },
    reset() {
      pendingPerformance.length = 0;
      identityReady = false;
      if (initialized) {
        stopRecording();
        ensureAnonymous();
      }
      context = { authState: "loading", pathname: context.pathname };
    },
    trackPerformance(event) {
      if (
        event.name !== "page_content_timing" &&
        event.name !== "personal_preparation_timing" &&
        event.name !== "catalog_content_visible"
      )
        return;
      const path = event.parameters.page_path;
      if (typeof path !== "string" || !analyticsPagePath(path)) return;
      capturePerformance(event.name, {
        ...event.parameters,
        $current_url: `${window.location.origin}${path}`,
        $pathname: path,
        page_load_id: pageLoadId,
        auth_state: context.authState,
        environment: options.environment,
        app_version: options.appVersion,
      });
    },
  };
}
