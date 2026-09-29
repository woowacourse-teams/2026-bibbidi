import { createAnalyticsClient } from "./analytics";
import { createGoogleAnalyticsProvider } from "./googleAnalyticsProvider";
import { createPostHogProvider } from "./posthogProvider";

const googleAnalyticsMeasurementId =
  typeof __BIBBIDI_GA_MEASUREMENT_ID__ === "string"
    ? __BIBBIDI_GA_MEASUREMENT_ID__
    : "";

const providers = googleAnalyticsMeasurementId
  ? [createGoogleAnalyticsProvider(googleAnalyticsMeasurementId)]
  : [];

if (
  typeof __BIBBIDI_POSTHOG_ENABLED__ !== "undefined" &&
  __BIBBIDI_POSTHOG_ENABLED__
) {
  providers.push(
    createPostHogProvider({
      enabled: true,
      token: __BIBBIDI_POSTHOG_PROJECT_TOKEN__,
      host: __BIBBIDI_POSTHOG_HOST__,
      environment: __BIBBIDI_APP_ENV__,
      appVersion: __BIBBIDI_APP_VERSION__,
    }),
  );
}

export const analytics = createAnalyticsClient(providers);

export type { AnalyticsClient, AnalyticsEvent } from "./analytics";
