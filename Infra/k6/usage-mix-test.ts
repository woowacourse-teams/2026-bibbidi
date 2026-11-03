import exec from 'k6/execution';
import type { Options, Scenario } from 'k6/options';
import { Environment, textFromEnv } from './src/common/environment.ts';
// refresh_rotation_violations 지표를 등록한다. 임계값 선언(generalThresholds)이 이 이름을 항상 참조한다.
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

// Q6: 운영 호출 비율 그대로 요청을 보내며 운영 최대 요청량의 ×10·50·100·200·400까지 올린다.
// 엔드포인트마다 도착률 시나리오를 따로 둔다.
// 합격 기준은 두지 않고 끝까지 돌린다. 캐시 전후 회차를 같은 단계까지 비교하려는 시험이다.
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

// 하위 지표는 임계값을 선언해야 요약에 나타난다. 판정에는 쓰지 않는 항상 참인 식이다.
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
  // 마지막 사용자가 없으면 시드의 사용자 수가 모자란 것이다. 사용자 행은 API로 만들 수 없다.
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

// 시나리오 이름(u00, u01, ...)이 USAGE_ENDPOINTS의 번호다.
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
