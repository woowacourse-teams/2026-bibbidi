import { createAnalyticsClient } from "./analytics";
import { createGoogleAnalyticsProvider } from "./googleAnalyticsProvider";
import { createPostHogProvider } from "./posthogProvider";
import type { HomeEntryVariant } from "./homeEntryExperiment";

const googleAnalyticsMeasurementId =
  typeof __BIBBIDI_GA_MEASUREMENT_ID__ === "string"
    ? __BIBBIDI_GA_MEASUREMENT_ID__
    : "";

const providers = googleAnalyticsMeasurementId
  ? [createGoogleAnalyticsProvider(googleAnalyticsMeasurementId)]
  : [];
let posthogProvider: ReturnType<typeof createPostHogProvider> | undefined;

if (
  typeof __BIBBIDI_POSTHOG_ENABLED__ !== "undefined" &&
  __BIBBIDI_POSTHOG_ENABLED__
) {
  posthogProvider = createPostHogProvider({
    enabled: true,
    token: __BIBBIDI_POSTHOG_PROJECT_TOKEN__,
    host: __BIBBIDI_POSTHOG_HOST__,
    environment: __BIBBIDI_APP_ENV__,
    appVersion: __BIBBIDI_APP_VERSION__,
  });
  providers.push(posthogProvider);
}

export const analytics = createAnalyticsClient(providers);

export function resolveHomeEntryVariant(): Promise<HomeEntryVariant> {
  return (
    posthogProvider?.resolveHomeEntryVariant() ?? Promise.resolve("control")
  );
}

export type { AnalyticsClient, AnalyticsEvent } from "./analytics";
export type { HomeEntryVariant } from "./homeEntryExperiment";
