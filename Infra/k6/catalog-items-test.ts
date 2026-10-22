import type { Options } from 'k6/options';
import './src/api/api.ts';
import { Environment, textFromEnv } from './src/common/environment.ts';
import { AccessTokenIssuer } from './src/common/token.ts';
import { WORST_CASE } from './src/config/targets.ts';
import { generalThresholds, type Thresholds } from './src/config/thresholds.ts';
import { HttpClient, endpointTag } from './src/http/http.ts';
import { responseMetric, STATUS_CODES, WorstCaseReport } from './src/report/worst-case-report.ts';
import type { SummaryData } from './src/report/summary.ts';
import { EndpointRunner, TARGETS, type EndpointData } from './src/scenario/endpoint-targets.ts';

const environment = Environment.fromEnv();
const client = new HttpClient(environment.baseUrl);
const tokens = new AccessTokenIssuer(environment);
const runner = new EndpointRunner(client, tokens);
const targetIndex = TARGETS.findIndex((target) => target.name === 'POST /api/checklists/me/catalog-items');
const target = TARGETS[targetIndex];
const endpoint = endpointTag(target.name);
const groups = [{ label: target.name, tags: `endpoint:${endpoint}` }];
const statuses: Thresholds = Object.fromEntries(STATUS_CODES.map((code) => [responseMetric(endpoint, code), ['count>=0']]));

export const options: Options = {
  scenarios: {
    catalog_items: { executor: 'constant-vus', vus: WORST_CASE.users, duration: `${WORST_CASE.holdSeconds}s`, gracefulStop: '10s' },
  },
  thresholds: { ...generalThresholds(groups), ...statuses },
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

export function setup(): EndpointData {
  // 기존 시드의 ID 범위는 워크플로에서 스냅샷 전에 검증한다. 여기서는 SQL을 발생시키지 않는다.
  const ids = Array.from({ length: 169 }, (_, index) => index + 1);
  if (Math.ceil(WORST_CASE.holdSeconds / WORST_CASE.periodSeconds) > ids.length - 3) throw new Error('측정 중 미등록 항목이 소진되는 부하 조건입니다.');
  return { runId: Math.floor(Date.now() / 1000), seededUsers: WORST_CASE.users, categoryIds: [], catalogItemIds: ids, termsVersion: '' };
}

export default function (data: EndpointData): void {
  runner.run(targetIndex, data);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  return new WorstCaseReport(data, '카탈로그 항목 추가 전후 비교',
    `${WORST_CASE.users} VU, ${WORST_CASE.holdSeconds}초, ${WORST_CASE.periodSeconds}초 간격, 최소 휴식 ${WORST_CASE.minRestSeconds}초. 요청당 항목 1개. 409는 기대 응답으로 분류되므로 상태별 건수도 확인합니다.`, groups)
    .withEndpoints([{ label: target.name, endpoint }])
    .withStatusRates()
    .files(textFromEnv('SUMMARY_DIR', '.'));
}
