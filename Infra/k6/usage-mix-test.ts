import exec from 'k6/execution';
import type { Options, Scenario } from 'k6/options';
import { Environment, textFromEnv } from './src/common/environment.ts';
import './src/api/api.ts';
import { AccessTokenIssuer } from './src/common/token.ts';
import { USAGE_LEVELS, UsageLadder } from './src/config/shape.ts';
import { REFRESH_TOKEN_COUNT, USAGE, WORST_CASE } from './src/config/targets.ts';
import { generalThresholds, type GatedGroup, type Thresholds } from './src/config/thresholds.ts';
import { HttpClient, endpointTag } from './src/http/http.ts';
import type { ReportGroup } from './src/report/general-report.ts';
import { responseMetric, STATUS_CODES, WorstCaseReport } from './src/report/worst-case-report.ts';
import type { SummaryData } from './src/report/summary.ts';
import { shareOf, USAGE_ENDPOINTS, UsageRunner, usageScenarioName, type UsageData } from './src/scenario/usage-mix.ts';
import { Seeded } from './src/session/users.ts';

const environment = Environment.fromEnv();
const ladder = new UsageLadder();
const client = new HttpClient(environment.baseUrl, ladder.tags());
const runner = new UsageRunner(client, new AccessTokenIssuer(environment));

function scenarios(): Record<string, Scenario> {
  return Object.fromEntries(
    USAGE_ENDPOINTS.map((endpoint, index): [string, Scenario] => [usageScenarioName(index), ladder.scenario('hit', shareOf(endpoint))]),
  );
}

const levelGroups: (GatedGroup & ReportGroup)[] = USAGE_LEVELS.map((level) => ({
  label: `×${level} 유지 전체`,
  tags: `stage:hold,level:x${level}`,
}));
const endpointGroups: (GatedGroup & ReportGroup)[] = USAGE_LEVELS.flatMap((level) =>
  USAGE_ENDPOINTS.map((endpoint) => ({
    label: `×${level} ${endpoint.name}`,
    tags: `stage:hold,level:x${level},endpoint:${endpointTag(endpoint.name)}`,
  })),
);
const groups = [...levelGroups, ...endpointGroups];

function responseThresholds(): Thresholds {
  return Object.fromEntries(
    USAGE_ENDPOINTS.flatMap((endpoint) => STATUS_CODES.map((code): [string, string[]] => [responseMetric(endpointTag(endpoint.name), code), ['count>=0']])),
  );
}

export const options: Options = {
  scenarios: scenarios(),
  thresholds: { ...generalThresholds(groups, false), ...responseThresholds() },
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

export function setup(): UsageData {
  const probe = new AccessTokenIssuer(environment).issue(Seeded.userId(WORST_CASE.users - 1));
  const lastUser = client.send(probe, { name: 'GET /api/users/me', method: 'GET', path: '/api/users/me', expected: [200], kind: 'fixture' });
  if (lastUser.status !== 200) {
    throw new Error(`시드 사용자가 ${WORST_CASE.users}명보다 적습니다(마지막 사용자 조회 ${lastUser.status}).`);
  }
  const catalog = client.send(probe, { name: 'GET /api/catalog', method: 'GET', path: '/api/catalog', expected: [200], kind: 'fixture' });
  const categories = (catalog.json() as unknown as { categories: { id: number; steps: { items: { id: number }[] }[] }[] }).categories;
  return {
    runId: Math.floor(Date.now() / 1000),
    seededUsers: WORST_CASE.users,
    categoryIds: categories.map((category) => category.id),
    catalogItemIds: categories.flatMap((category) => category.steps.flatMap((step) => step.items.map((item) => item.id))).sort((a, b) => a - b),
    refreshTokenCount: REFRESH_TOKEN_COUNT,
  };
}

export function hit(data: UsageData): void {
  runner.run(Number(exec.scenario.name.slice(1)), data);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  return new WorstCaseReport(
    data,
    'Q6 운영 호출 비율 단계 시험',
    `운영 호출 비율대로 초당 ${USAGE.peakRequestsPerSecond}건의 ${USAGE_LEVELS.map((level) => `×${level}`).join('·')}까지 올린 결과입니다. 합격 기준 없이 단계별 유지 구간을 기록합니다.`,
    groups,
  )
    .withEndpoints(USAGE_ENDPOINTS.map((endpoint) => ({ label: endpoint.name, endpoint: endpointTag(endpoint.name) })))
    .files(textFromEnv('SUMMARY_DIR', '.'));
}
