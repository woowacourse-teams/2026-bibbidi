import { createAnalyticsClient } from "./analytics";
import { createGoogleAnalyticsProvider } from "./googleAnalyticsProvider";
import { createPostHogProvider } from "./posthogProvider";
import { startPageContentTiming, type TimingRouter } from "./pageContentTiming";

const googleAnalyticsMeasurementId =
  typeof process.env.NEXT_PUBLIC_BIBBIDI_GA_MEASUREMENT_ID === "string"
    ? process.env.NEXT_PUBLIC_BIBBIDI_GA_MEASUREMENT_ID
    : "";

const providers = googleAnalyticsMeasurementId
  ? [createGoogleAnalyticsProvider(googleAnalyticsMeasurementId)]
  : [];
let posthogProvider: ReturnType<typeof createPostHogProvider> | undefined;

if (process.env.NEXT_PUBLIC_BIBBIDI_POSTHOG_ENABLED === "true") {
  posthogProvider = createPostHogProvider({
    enabled: true,
    token: process.env.NEXT_PUBLIC_BIBBIDI_POSTHOG_PROJECT_TOKEN ?? "",
    host: process.env.NEXT_PUBLIC_BIBBIDI_POSTHOG_HOST ?? "",
    environment: process.env.NEXT_PUBLIC_BIBBIDI_APP_ENV ?? "",
    appVersion: process.env.NEXT_PUBLIC_BIBBIDI_APP_VERSION ?? "",
  });
  providers.push(posthogProvider);
}

export const analytics = createAnalyticsClient(providers);

export function startPagePerformanceTracking(router: TimingRouter) {
  const provider = posthogProvider;
  if (!provider) return () => {};
  const stopTracking = (["content", "personal", "catalog"] as const).map(
    (measure) =>
      startPageContentTiming(router, provider.trackPerformance, measure),
  );
  return () => stopTracking.forEach((stop) => stop());
}

export type { AnalyticsClient, AnalyticsEvent } from "./analytics";
