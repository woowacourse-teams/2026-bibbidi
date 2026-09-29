import posthog, { type PostHog } from "posthog-js";

import type { AnalyticsContext, AnalyticsProvider } from "./analytics";
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
  | "startSessionRecording"
  | "stopSessionRecording"
>;
const MEMBER_PREFIX = "bibbidi:user:";

export function createPostHogProvider(
  options: PostHogOptions,
  sdk: PostHogSdk = posthog,
): AnalyticsProvider {
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
      if (initialized || !options.enabled || !options.token) return;
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
        advanced_disable_feature_flags: true,
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
        environment: options.environment,
        app_version: options.appVersion,
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
  };
}
