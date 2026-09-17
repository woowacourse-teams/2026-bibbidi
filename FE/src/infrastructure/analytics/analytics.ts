export type AnalyticsEventParameter = boolean | number | string;

export interface AnalyticsEvent {
  name: string;
  parameters: Record<string, AnalyticsEventParameter>;
}

export interface AnalyticsProvider {
  initialize: () => void;
  track: (event: AnalyticsEvent) => void;
}

export interface AnalyticsClient {
  initialize: () => void;
  track: (event: AnalyticsEvent) => void;
}

function runSafely(action: () => void) {
  try {
    action();
  } catch {
    // 분석 도구 장애가 제품 사용 흐름에 영향을 주지 않도록 격리한다.
  }
}

export function createAnalyticsClient(
  providers: AnalyticsProvider[],
): AnalyticsClient {
  return {
    initialize() {
      for (const provider of providers) {
        runSafely(provider.initialize);
      }
    },
    track(event) {
      for (const provider of providers) {
        runSafely(() => provider.track(event));
      }
    },
  };
}
