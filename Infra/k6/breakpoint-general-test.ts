import type { Options } from 'k6/options';
import { ApiFactory } from './src/api/api.ts';
import { BreakpointReport } from './src/breakpoint/breakpoint-report.ts';
import { Environment, numberFromEnv, textFromEnv } from './src/common/environment.ts';
import { HttpClient, StrictExpectation } from './src/http/http.ts';
import { LoadTest } from './src/scenario/load-test.ts';
import { NewUserSession, ReturningUserSession, SessionMix, type SetupData } from './src/session/session.ts';
import type { SummaryData } from './src/report/summary.ts';
import { AccessTokenIssuer } from './src/common/token.ts';
import { WindowMetrics } from './src/breakpoint/window-metrics.ts';
import { WindowPlan } from './src/breakpoint/windows.ts';

const environment = Environment.fromEnv();

const plan = new WindowPlan({
  windowSeconds: numberFromEnv('WINDOW_SECONDS', 30),
  stepRate: numberFromEnv('STEP_RATE', 3),
  windows: numberFromEnv('WINDOWS', 20),
  evalDelaySeconds: numberFromEnv('EVAL_DELAY_SECONDS', 20),
});

const mix = new SessionMix([
  { session: new NewUserSession(), weight: 6 },
  { session: new ReturningUserSession(), weight: 4 },
]);

const client = new HttpClient(environment.baseUrl, new StrictExpectation(), () => ({}), [new WindowMetrics(plan)]);
const apis = new ApiFactory(client, new AccessTokenIssuer(environment));
const test = new LoadTest(apis, mix, numberFromEnv('POOL_SIZE', 50));

const preAllocatedVUs = numberFromEnv('PRE_ALLOCATED_VUS', plan.endRate(plan.windows) * 3);

export const options: Options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs,
      maxVUs: numberFromEnv('MAX_VUS', Math.max(500, preAllocatedVUs * 2)),
      stages: plan.stages(),
    },
  },
  thresholds: plan.thresholds(),
  setupTimeout: '5m',
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

export function setup(): SetupData {
  return test.setup();
}

export default function (data: SetupData): void {
  test.run(data);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  return new BreakpointReport(data, plan).files(textFromEnv('SUMMARY_DIR', '.'));
}
