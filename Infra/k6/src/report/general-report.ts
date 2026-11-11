import { BURST_DURATION, BURST_REQUESTS, GENERAL_DURATION, REFRESH_VIOLATIONS, generalMetric } from '../config/thresholds.ts';
import { SLO } from '../config/targets.ts';
import { SummaryReport, type SummaryData } from './summary.ts';

export interface ReportGroup {
  label: string;
  tags: string;
  p95?: boolean;
  p99?: boolean;
  failure?: boolean;
}

export interface GroupResult {
  group: ReportGroup;
  requests: number;
  newUsers: number;
  p95: number | undefined;
  p99: number | undefined;
  failureRate: number | undefined;
  failures: string[];
}

// 일반 API 응답을 구간(phase)이나 단계(stage)로 나눠 SLO와 비교하는 보고서.
export class GeneralSloReport extends SummaryReport {
  constructor(
    data: SummaryData,
    protected readonly title: string,
    protected readonly intro: string,
    protected readonly groups: readonly ReportGroup[],
  ) {
    super(data);
  }

  toMarkdown(): string {
    const results = this.groups.map((group) => this.resultOf(group));
    const failed = results.filter((result) => result.failures.length > 0);
    const passed = failed.length === 0 && this.failedThresholds().length === 0;

    return [
      `## ${this.title}`,
      '',
      `> ${this.intro}`,
      '',
      `- 판정: ${passed ? '✅ 기준 이내' : '❌ 기준을 넘음'}`,
      ...failed.map((result) => `- ${result.group.label}: ${result.failures.join(', ')}`),
      '',
      ...this.body(),
      '',
      '### 전체 요약',
      '',
      ...this.overview(passed),
      ...this.thresholdLines(),
      '',
    ].join('\n');
  }

  // 구간 표와 기준 설명. 다른 보고서에 붙여 쓸 수 있다.
  body(): string[] {
    return [
      ...this.table(this.groups.map((group) => this.resultOf(group))),
      '',
      `기준: p95 ${SLO.generalP95Ms}ms 미만, p99 ${SLO.generalP99Ms}ms 미만, 실패율 ${(SLO.generalFailureRate * 100).toFixed(2)}% 미만. 기준을 거는 구간만 판정하고 나머지는 기록만 합니다.`,
      '',
      this.burstLine(),
    ];
  }

  // 응답 시간 요약은 SSE(AI)를 뺀 일반 API만 센다.
  protected durationMetric(): string {
    return GENERAL_DURATION;
  }

  protected resultOf(group: ReportGroup): GroupResult {
    const duration = generalMetric('http_req_duration', group.tags);
    const p95 = this.value(duration, 'p(95)');
    const p99 = this.value(duration, 'p(99)');
    const failureRate = this.value(generalMetric('http_req_failed', group.tags), 'rate');
    const failures: string[] = [];

    if (group.p95 && p95 !== undefined && p95 >= SLO.generalP95Ms) {
      failures.push(`p95 ${p95.toFixed(0)}ms`);
    }
    if (group.p99 && p99 !== undefined && p99 >= SLO.generalP99Ms) {
      failures.push(`p99 ${p99.toFixed(0)}ms`);
    }
    if (group.failure && failureRate !== undefined && failureRate >= SLO.generalFailureRate) {
      failures.push(`실패율 ${(failureRate * 100).toFixed(2)}%`);
    }

    return {
      group,
      requests: this.value(generalMetric('http_reqs', group.tags), 'count') ?? 0,
      newUsers: this.value(`new_users{${group.tags}}`, 'count') ?? 0,
      p95,
      p99,
      failureRate,
      failures,
    };
  }

  private table(results: readonly GroupResult[]): string[] {
    const header = ['구간', '신규 사용자', '요청 수', 'p95(ms)', 'p99(ms)', '실패율(%)', '판정'];
    const rows = results.map((result) => [
      result.group.label,
      this.format(result.newUsers, 0),
      this.format(result.requests, 0),
      this.format(result.p95, 0),
      this.format(result.p99, 0),
      result.failureRate === undefined ? '-' : (result.failureRate * 100).toFixed(2),
      this.verdict(result),
    ]);
    return [
      `| ${header.join(' | ')} |`,
      `| ${header.map(() => '---').join(' | ')} |`,
      ...rows.map((row) => `| ${row.join(' | ')} |`),
    ];
  }

  private verdict(result: GroupResult): string {
    const gated = result.group.p95 || result.group.p99 || result.group.failure;
    if (!gated) {
      return '기록';
    }
    if (result.requests === 0) {
      return '도달 못함';
    }
    return result.failures.length === 0 ? '✅' : '❌';
  }

  // 같은 리프레시 토큰을 동시에 두 번 보내는 흐름(여러 탭)의 응답 시간. 재사용 401을 일부러 받으므로 판정에서 뺀다.
  private burstLine(): string {
    const p95 = this.value(BURST_DURATION, 'p(95)');
    const count = this.value(BURST_REQUESTS, 'count');
    const violations = this.value(REFRESH_VIOLATIONS, 'count') ?? 0;
    const rotation = violations === 0 ? '✅ 200 하나 + 401 하나' : `❌ 200/401 조합이 어긋난 쌍 ${violations}건`;
    return `여러 탭 동시 갱신(응답 시간은 판정 제외): 요청 ${count === undefined ? '-' : count.toFixed(0)}건, p95 ${this.format(p95, 0)}ms, 토큰 회전 ${rotation}`;
  }

  private thresholdLines(): string[] {
    const failed = this.failedThresholds();
    return failed.length === 0 ? [] : ['', '기준을 넘은 항목', ...failed.map((entry) => `- ${entry}`)];
  }
}
