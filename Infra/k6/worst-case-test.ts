import exec from 'k6/execution';
import type { Options, Scenario } from 'k6/options';
import { Environment, textFromEnv } from './src/common/environment.ts';
// refresh_rotation_violations 지표를 등록한다. 임계값 선언(generalThresholds)이 이 이름을 항상 참조한다.
import './src/api/api.ts';
import { AccessTokenIssuer } from './src/common/token.ts';
import { WORST_CASE } from './src/config/targets.ts';
import { generalThresholds, type GatedGroup, type Thresholds } from './src/config/thresholds.ts';
import { HttpClient, endpointTag } from './src/http/http.ts';
import type { ReportGroup } from './src/report/general-report.ts';
import { responseMetric, STATUS_CODES, WorstCaseReport } from './src/report/worst-case-report.ts';
import type { SummaryData } from './src/report/summary.ts';
import { EndpointRunner, scenarioNameOf, TARGETS, type EndpointData } from './src/scenario/endpoint-targets.ts';
import { Seeded } from './src/session/users.ts';

// Q5: 엔드포인트마다 동시 사용자 1000명이 같은 순간에 요청 1개씩 보내고 쉬기를 되풀이한다(기본 3초 간격, 최소 휴식 1초).
// 사람 1000명이 각자 한 번씩 누르는 상황이라, 서버가 느려져도 응답을 받은 뒤에야 다음 요청을 보낸다.
// 엔드포인트는 차례로 하나씩 시험한다(앞 시험 뒤 15초 간격). 사용자는 시드가 만든 사용자 1000명이다.
// 합격 기준은 두지 않는다. 엔드포인트마다 응답 시간(p95·p99)과 실패율, 받은 상태 코드를 기록해 부하 정도만 본다.
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
}));

// 하위 지표는 임계값을 선언해야 요약에 나타난다. 판정에는 쓰지 않는 항상 참인 식이다.
function responseThresholds(): Thresholds {
  return Object.fromEntries(
    TARGETS.flatMap((target) => STATUS_CODES.map((code): [string, string[]] => [responseMetric(endpointTag(target.name), code), ['count>=0']])),
  );
}

export const options: Options = {
  scenarios: scenarios(),
  thresholds: { ...generalThresholds(groups), ...responseThresholds() },
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

export function setup(): EndpointData {
  const tokens = new AccessTokenIssuer(environment);
  const probe = tokens.issue(Seeded.userId(WORST_CASE.users - 1));
  // 마지막 사용자가 없으면 시드의 사용자 수가 모자란 것이다. 사용자 행은 API로 만들 수 없어 시드(seed-users)를 늘려야 한다.
  const lastUser = client.send(probe, { name: 'GET /api/users/me', method: 'GET', path: '/api/users/me', expected: [200], kind: 'fixture' });
  if (lastUser.status !== 200) {
    throw new Error(`시드 사용자가 ${WORST_CASE.users}명보다 적습니다(마지막 사용자 조회 ${lastUser.status}). Infra/loadtest/params/<회차>.seed-users 를 확인하세요.`);
  }
  const catalog = client.send(probe, { name: 'GET /api/catalog', method: 'GET', path: '/api/catalog', expected: [200], kind: 'fixture' });
  const categories = (catalog.json() as unknown as { categories: { id: number; steps: { items: { id: number }[] }[] }[] }).categories;
  const terms = client.send(probe, { name: 'GET /api/terms', method: 'GET', path: '/api/terms', expected: [200], kind: 'fixture' });
  return {
    runId: Math.floor(Date.now() / 1000),
    seededUsers: WORST_CASE.users,
    categoryIds: categories.map((category) => category.id),
    catalogItemIds: categories.flatMap((category) => category.steps.flatMap((step) => step.items.map((item) => item.id))).sort((a, b) => a - b),
    termsVersion: (terms.json() as unknown as { version: string }[])[0]?.version ?? '',
  };
}

// 시나리오 이름(t00, t01, ...)이 TARGETS의 번호다.
export function hit(data: EndpointData): void {
  runner.run(Number(exec.scenario.name.slice(1)), data);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  return new WorstCaseReport(
    data,
    'Q5 엔드포인트별 동시 사용자 1000명',
    `엔드포인트마다 ${WORST_CASE.users}명이 ${WORST_CASE.periodSeconds}초 간격으로 같은 순간에 요청하기를 ${WORST_CASE.holdSeconds}초 동안 되풀이한 결과입니다. 합격 기준 없이 부하 정도를 기록합니다.`,
    groups,
  )
    .withEndpoints(TARGETS.map((target) => ({ label: target.name, endpoint: endpointTag(target.name) })))
    .files(textFromEnv('SUMMARY_DIR', '.'));
}
