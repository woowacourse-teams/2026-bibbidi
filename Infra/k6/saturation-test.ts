import type { Options } from 'k6/options';
import { Environment, textFromEnv } from './src/common/environment.ts';
import { LADDER_LEVELS, SaturationLadder } from './src/config/shape.ts';
import { generalThresholds, type GatedGroup } from './src/config/thresholds.ts';
import { GeneralSloReport, type ReportGroup } from './src/report/general-report.ts';
import type { SummaryData } from './src/report/summary.ts';
import { GeneralLoad, generalScenarios } from './src/scenario/promotion.ts';
import type { SetupData } from './src/session/session.ts';

// Q2(#536): 홍보일 피크 × 1 → 2 → 5 → 10으로 올리며 먼저 포화되는 자원을 찾는다.
// 단계마다 30초 상승 + 2분 유지이고, 유지 구간만 판정한다. 상승 구간은 stage=ramp로 태그해 판정에서 뺀다.
// 유지 구간 p99나 실패율이 깨지면 테스트를 멈춘다(종료 코드 99). 그 단계가 포화점이다.
// 리프레시 토큰 동시 갱신(여러 탭)과 카탈로그 조회 비중은 일반 흐름 안에 섞여 있다.
const environment = Environment.fromEnv();
const ladder = new SaturationLadder();
const load = new GeneralLoad(environment, ladder.tags());

// 멈추기 전에 구간 표본이 쌓이도록 유지 구간이 시작하고 30초 뒤부터 판정한다.
const ABORT_GRACE_SECONDS = 30;

const gated: (GatedGroup & ReportGroup)[] = LADDER_LEVELS.map((level, index) => ({
  label: `피크 ×${level} 유지`,
  tags: `stage:hold,level:x${level}`,
  p99: true,
  failure: true,
  abortAfterSeconds: ladder.holdStartSeconds(index) + ABORT_GRACE_SECONDS,
}));
const ramp: ReportGroup & GatedGroup = { label: '상승 구간(판정 제외)', tags: 'stage:ramp' };
const groups = [...gated, ramp];

export const options: Options = {
  scenarios: generalScenarios(ladder),
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
    'Q2 먼저 포화되는 자원',
    '피크 ×1·2·5·10 단계의 유지 구간을 판정합니다. 처음 ❌가 나온 단계가 포화점이고, 그 뒤 단계는 도달하지 못할 수 있습니다.',
    groups,
  ).files(textFromEnv('SUMMARY_DIR', '.'));
}
