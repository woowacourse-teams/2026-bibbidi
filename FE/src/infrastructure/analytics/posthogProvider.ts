import posthog, { type PostHog } from "posthog-js";

import type { AnalyticsContext, AnalyticsProvider } from "./analytics";
import {
  HOME_ENTRY_EXPERIMENT_KEY,
  type HomeEntryVariant,
} from "./homeEntryExperiment";
import {
  analyticsPagePath,
  PRIVATE_REPLAY_CONFIG,
  sanitizePostHogEvent,
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
  | "onFeatureFlags"
  | "getFeatureFlag"
  | "startSessionRecording"
  | "stopSessionRecording"
> & {
  featureFlags: Pick<PostHog["featureFlags"], "ensureFlagsLoaded">;
};
const FLAG_WAIT_MS = 2000;
const MEMBER_PREFIX = "bibbidi:user:";
// CloudFront 함수(bibbidi-internal-traffic-cookie)가 캠퍼스 IP 응답에 붙이는 쿠키
const INTERNAL_TRAFFIC_COOKIE = "bibbidi_internal=1";

const isInternalTraffic = () =>
  document.cookie.split("; ").includes(INTERNAL_TRAFFIC_COOKIE);

export function createPostHogProvider(
  options: PostHogOptions,
  sdk: PostHogSdk = posthog,
): AnalyticsProvider & {
  resolveHomeEntryVariant: () => Promise<HomeEntryVariant>;
} {
  let initialized = false;
  let recording = false;
  let identityReady = false;
  let context: AnalyticsContext = { authState: "loading", pathname: "/" };

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
    [
      "guest",
      "onboardingRequired",
      "accountSetupRequired",
      "authenticated",
    ].includes(context.authState);

  return {
    initialize() {
      if (
        initialized ||
        !options.enabled ||
        !options.token ||
        isInternalTraffic()
      )
        return;
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
        capture_performance: false,
        capture_exceptions: false,
        enable_recording_console_log: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_conversations: true,
        disable_web_experiments: true,
        advanced_disable_feature_flags: false,
        save_referrer: true,
        save_campaign_params: true,
        disable_capture_url_hashes: true,
        respect_dnt: true,
        session_recording: PRIVATE_REPLAY_CONFIG,
        before_send: (event) => {
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
      identityReady = false;
      if (initialized) {
        stopRecording();
        ensureAnonymous();
      }
      context = { authState: "loading", pathname: context.pathname };
    },
    resolveHomeEntryVariant() {
      if (!initialized || !identityReady || !isSettled()) {
        return Promise.resolve("control");
      }

      return new Promise<HomeEntryVariant>((resolve) => {
        let resolved = false;
        let unsubscribe: (() => void) | undefined;
        const finish = (variant: HomeEntryVariant) => {
          if (resolved) return;
          resolved = true;
          window.clearTimeout(timeout);
          unsubscribe?.();
          resolve(variant);
        };
        const timeout = window.setTimeout(
          () => finish("control"),
          FLAG_WAIT_MS,
        );

        try {
          unsubscribe = sdk.onFeatureFlags((_flags, _variants, context) => {
            if (context?.errorsLoading) {
              finish("control");
              return;
            }
            try {
              finish(
                sdk.getFeatureFlag(HOME_ENTRY_EXPERIMENT_KEY) === "test"
                  ? "test"
                  : "control",
              );
            } catch {
              finish("control");
            }
          });
          if (resolved) unsubscribe();
          // 첫 방문 익명 사용자는 SDK가 원격 설정을 받은 뒤에야 플래그를 요청해 대기 시간을 넘긴다.
          else sdk.featureFlags.ensureFlagsLoaded();
        } catch {
          finish("control");
        }
      });
    },
  };
}
