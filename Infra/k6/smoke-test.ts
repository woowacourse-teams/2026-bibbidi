import type { Options } from 'k6/options';
import { ApiFactory } from './src/api.ts';
import { Environment, numberFromEnv, textFromEnv } from './src/environment.ts';
import { HttpClient } from './src/http.ts';
import { LoadTest } from './src/load-test.ts';
import { NewUserSession, ReturningUserSession, SessionSequence, type SetupData } from './src/session.ts';
import { SummaryReport, type SummaryData } from './src/summary.ts';
import { AccessTokenIssuer } from './src/token.ts';

const environment = Environment.fromEnv();

const sessions = new SessionSequence([new NewUserSession(), new ReturningUserSession()]);

const apis = new ApiFactory(new HttpClient(environment.baseUrl), new AccessTokenIssuer(environment));
const test = new LoadTest(apis, sessions, numberFromEnv('POOL_SIZE', 1));

export const options: Options = {
  scenarios: {
    smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: numberFromEnv('ITERATIONS', 2),
      maxDuration: textFromEnv('MAX_DURATION', '30s'),
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
