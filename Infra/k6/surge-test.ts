import type { Options } from 'k6/options';
import { Environment, textFromEnv } from './src/common/environment.ts';
import { PromotionShape } from './src/config/shape.ts';
import { generalThresholds } from './src/config/thresholds.ts';
import { GeneralSloReport, type ReportGroup } from './src/report/general-report.ts';
import type { SummaryData } from './src/report/summary.ts';
import { GeneralLoad, generalScenarios } from './src/scenario/promotion.ts';
import type { SetupData } from './src/session/session.ts';

// Q1(#535): 홍보일과 같은 모양의 급증을 서버가 버티는지 본다.
// 평소 → 급증 → 피크 유지 → 감소를 재현하고, 급증 직후(surge)를 따로 판정한다.
// 커넥션 생성(minimum-idle: 1), JIT 예열, 스레드 생성 비용이 급증 직후에 몰리기 때문이다.
// 차가운 상태에서 시작해야 하므로 직전에 스모크로 서버를 데우지 않는다.
const environment = Environment.fromEnv();
const shape = new PromotionShape();
const load = new GeneralLoad(environment, shape.tags());

const groups: ReportGroup[] = [
  { label: '평소(baseline)', tags: 'phase:baseline' },
  { label: '급증(surge)', tags: 'phase:surge', p99: true, failure: true },
  { label: '피크 유지(peak)', tags: 'phase:peak', p95: true, p99: true, failure: true },
  { label: '감소(decay)', tags: 'phase:decay' },
];

export const options: Options = {
  scenarios: generalScenarios(shape),
  thresholds: generalThresholds(groups),
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

export function setup(): SetupData {
  return load.setup();
}

export function newUser(data: SetupData): void {
  load.newUser(data);
}

export function returningUser(data: SetupData): void {
  load.returningUser(data);
}

export function catalogBrowse(data: SetupData): void {
  load.catalogBrowse(data);
}

export function tokenRefresh(data: SetupData): void {
  load.tokenRefresh(data);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  return new GeneralSloReport(
    data,
    'Q1 홍보일 급증',
    '평소 → 급증 → 피크 유지 → 감소의 홍보일 모양을 재현했습니다. 급증(surge)과 피크(peak) 구간을 판정합니다.',
    groups,
  ).files(textFromEnv('SUMMARY_DIR', '.'));
}
