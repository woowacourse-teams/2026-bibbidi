import exec from 'k6/execution';
import type { Options, Scenario } from 'k6/options';
import { Environment, textFromEnv } from './src/common/environment.ts';
import { AccessTokenIssuer } from './src/common/token.ts';
import { WORST_CASE } from './src/config/targets.ts';
import { generalThresholds, type GatedGroup } from './src/config/thresholds.ts';
import { HttpClient, endpointTag } from './src/http/http.ts';
import { GeneralSloReport, type ReportGroup } from './src/report/general-report.ts';
import type { SummaryData } from './src/report/summary.ts';
import { EndpointRunner, scenarioNameOf, TARGETS, type EndpointData } from './src/scenario/endpoint-targets.ts';
import { UserIds } from './src/session/users.ts';

// Q5: 엔드포인트마다 동시 사용자 1000명이 1분간 그 엔드포인트만 쉬지 않고 부른다.
// 엔드포인트는 차례로 하나씩 시험하고(앞 시험 뒤 15초 간격), 사용자 수는 처음부터 1000명이다.
// 엔드포인트마다 p95·p99·실패율을 판정하고 서버 오류(5xx)는 한 건도 없어야 한다.
const environment = Environment.fromEnv();
const client = new HttpClient(environment.baseUrl);
const runner = new EndpointRunner(client, new AccessTokenIssuer(environment));

function scenarios(): Record<string, Scenario> {
  const slot = WORST_CASE.holdSeconds + WORST_CASE.gapSeconds;
  return Object.fromEntries(
    TARGETS.map((_, index): [string, Scenario] => [
      scenarioNameOf(index),
      {
        executor: 'constant-vus',
        exec: 'hit',
        vus: WORST_CASE.users,
        duration: `${WORST_CASE.holdSeconds}s`,
        startTime: `${index * slot}s`,
        gracefulStop: '10s',
      },
    ]),
  );
}

const groups: (GatedGroup & ReportGroup)[] = TARGETS.map((target) => ({
  label: target.name,
  tags: `endpoint:${endpointTag(target.name)}`,
  p95: true,
  p99: true,
  failure: true,
}));

export const options: Options = {
  scenarios: scenarios(),
  thresholds: { ...generalThresholds(groups), server_errors: ['count==0'] },
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

export function setup(): EndpointData {
  const tokens = new AccessTokenIssuer(environment);
  const catalog = client.send(tokens.issue(UserIds.pooled(0)), {
    name: 'GET /api/catalog',
    method: 'GET',
    path: '/api/catalog',
    expected: [200],
    kind: 'fixture',
  });
  const categories = (catalog.json() as unknown as { categories: { id: number; steps: { items: { id: number }[] }[] }[] }).categories;
  const terms = client.send(tokens.issue(UserIds.pooled(0)), { name: 'GET /api/terms', method: 'GET', path: '/api/terms', expected: [200], kind: 'fixture' });
  return {
    runId: Math.floor(Date.now() / 1000),
    categoryIds: categories.map((category) => category.id),
    itemIds: categories.flatMap((category) => category.steps.flatMap((step) => step.items.map((item) => item.id))),
    termsVersion: (terms.json() as unknown as { version: string }[])[0]?.version ?? '',
  };
}

// 시나리오 이름(t00, t01, ...)이 TARGETS의 번호다.
export function hit(data: EndpointData): void {
  runner.run(Number(exec.scenario.name.slice(1)), data);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  return new GeneralSloReport(
    data,
    'Q5 엔드포인트별 동시 사용자 1000명',
    `엔드포인트마다 ${WORST_CASE.users}명이 ${WORST_CASE.holdSeconds}초 동안 동시에 부른 결과입니다. ❌나 도달 못함이 있는 엔드포인트는 이 부하에서 신뢰할 수 없습니다.`,
    groups,
  ).files(textFromEnv('SUMMARY_DIR', '.'));
}
