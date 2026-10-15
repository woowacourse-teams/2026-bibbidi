import type { Options } from 'k6/options';
import { ApiFactory } from './src/api.ts';
import { Environment, numberFromEnv, textFromEnv } from './src/environment.ts';
import { HttpClient } from './src/http.ts';
import { LoadTest } from './src/load-test.ts';
import { NewUserSession, ReturningUserSession, SessionMix, type SetupData } from './src/session.ts';
import { SummaryReport, type SummaryData } from './src/summary.ts';
import { AccessTokenIssuer } from './src/token.ts';

const environment = Environment.fromEnv();

// 신규:재방문 = 3:7
const mix = new SessionMix([
  { session: new NewUserSession(), weight: 3 },
  { session: new ReturningUserSession(), weight: 7 },
]);

const apis = new ApiFactory(new HttpClient(environment.baseUrl), new AccessTokenIssuer(environment));
const test = new LoadTest(apis, mix, numberFromEnv('POOL_SIZE', 10));

// Smoke는 경로가 끝까지 동작하는지만 본다. 성공 기준은 모든 check 통과와 5xx 0건이고, 응답 시간 기준은 걸지 않는다.
export const options: Options = {
  scenarios: {
    smoke: {
      executor: 'constant-arrival-rate',
      rate: numberFromEnv('RATE', 1),
      timeUnit: '1s',
      duration: textFromEnv('DURATION', '1m'),
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
  },
  thresholds: {
    checks: ['rate==1'],
    server_errors: ['count==0'],
  },
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

export function setup(): SetupData {
  return test.setup();
}

export default function (data: SetupData): void {
  test.run(data);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  return new SummaryReport(data).files(textFromEnv('SUMMARY_DIR', '.'));
}
