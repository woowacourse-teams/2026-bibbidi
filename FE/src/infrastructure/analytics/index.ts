import { createAnalyticsClient } from "./analytics";
import { createGoogleAnalyticsProvider } from "./googleAnalyticsProvider";

const googleAnalyticsMeasurementId =
  typeof __BIBBIDI_GA_MEASUREMENT_ID__ === "string"
    ? __BIBBIDI_GA_MEASUREMENT_ID__
    : "";

const providers = googleAnalyticsMeasurementId
  ? [createGoogleAnalyticsProvider(googleAnalyticsMeasurementId)]
  : [];

export const analytics = createAnalyticsClient(providers);

export type { AnalyticsClient, AnalyticsEvent } from "./analytics";
