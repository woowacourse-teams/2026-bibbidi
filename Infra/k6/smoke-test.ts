import type { Options } from 'k6/options';
import { Environment, numberFromEnv, textFromEnv } from './src/common/environment.ts';
import { GeneralLoad } from './src/scenario/promotion.ts';
import { SummaryReport, type SummaryData } from './src/report/summary.ts';
import {
  CatalogBrowseSession,
  NewUserSession,
  ReturningUserSession,
  SessionSequence,
  TokenRefreshSession,
  type SetupData,
} from './src/session/session.ts';

const environment = Environment.fromEnv();

// 일반 API 흐름 4종을 한 번씩 돌려 본다. 신규, 재방문, 카탈로그, 토큰 갱신 순서다.
const sessions = new SessionSequence([
  new NewUserSession(),
  new ReturningUserSession(),
  new CatalogBrowseSession(),
  new TokenRefreshSession(),
]);
const load = new GeneralLoad(environment, () => ({}));

export const options: Options = {
  scenarios: {
    smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: numberFromEnv('ITERATIONS', 4),
      maxDuration: textFromEnv('MAX_DURATION', '2m'),
    },
  },
  thresholds: {
    checks: ['rate==1'],
    server_errors: ['count==0'],
    refresh_rotation_violations: ['count==0'],
  },
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

export function setup(): SetupData {
  return load.setup();
}

export default function (data: SetupData): void {
  load.runner().runSelected(sessions, data);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  return new SummaryReport(data).files(textFromEnv('SUMMARY_DIR', '.'));
}
