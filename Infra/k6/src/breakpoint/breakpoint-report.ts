import { SummaryReport, type SummaryData } from '../report/summary.ts';
import type { WindowPlan } from './windows.ts';

type WindowVerdict = '정상' | '고장' | '도달 못함';

interface WindowResult {
  window: number;
  endRate: number;
  rps: number | undefined;
  p99: number | undefined;
  errorRate: number | undefined;
  verdict: WindowVerdict;
  causes: string[];
}

export class BreakpointReport extends SummaryReport {
  constructor(
    data: SummaryData,
    private readonly plan: WindowPlan,
  ) {
    super(data);
  }

  toMarkdown(): string {
    const results = this.windowResults();
    const failedWindow = results.find((result) => result.verdict === '고장');

    return [
      '## k6 Breakpoint 결과',
      '',
      `> 시나리오 1건은 사용자 한 명이 사용 흐름을 한 번 끝까지 지나가는 것입니다. 신규 사용자는 둘러보기, 체크리스트 담기, 일정 잡기, 홈 순서이고 재방문 사용자는 홈, 일정 완료 순서입니다. 초당 시나리오 수를 ${this.plan.windowSeconds}초 구간마다 ${this.plan.stepRate}씩 올립니다.`,
      '',
      ...this.conclusion(results, failedWindow),
      '',
      ...this.windowTable(results),
      '',
      '### 전체 요약',
      '',
      ...this.overview(failedWindow === undefined),
      '',
    ].join('\n');
  }

  private windowResults(): WindowResult[] {
    const lastObserved = this.lastObservedWindow();
    const dropped = (this.value('dropped_iterations', 'count') ?? 0) > 0;

    return Array.from({ length: this.plan.windows }, (_, index) => {
      const window = index + 1;
      const latency = this.metric(`window_latency{window:${window}}`);
      const errors = this.metric(`window_server_error{window:${window}}`);
      const requestCount = this.value(`window_requests{window:${window}}`, 'count') ?? 0;
      const reached = requestCount > 0;
      const causes: string[] = [];

      if (this.hasFailedThreshold(latency)) causes.push('조회 응답 시간(p99)이 1초 초과');
      if (this.hasFailedThreshold(errors)) causes.push('서버 오류(5xx) 비율이 1% 초과');
      if (dropped && window === lastObserved) causes.push('서버가 따라가지 못함(건너뛴 시나리오 발생)');

      return {
        window,
        endRate: this.plan.endRate(window),
        rps: reached ? requestCount / this.plan.windowSeconds : undefined,
        p99: reached ? latency?.values?.['p(99)'] : undefined,
        errorRate: reached ? errors?.values?.rate : undefined,
        verdict: causes.length > 0 ? '고장' : reached ? '정상' : '도달 못함',
        causes,
      };
    });
  }

  private lastObservedWindow(): number {
    let last = 0;
    for (let window = 1; window <= this.plan.windows; window += 1) {
      if ((this.value(`window_requests{window:${window}}`, 'count') ?? 0) > 0) {
        last = window;
      }
    }
    return last;
  }

  private hasFailedThreshold(metric: ReturnType<SummaryReport['metric']>): boolean {
    return Object.values(metric?.thresholds ?? {}).some((result) => !result.ok);
  }

  private conclusion(results: WindowResult[], failedWindow: WindowResult | undefined): string[] {
    if (failedWindow === undefined) {
      const last = results.filter((result) => result.verdict === '정상').pop();
      const reached = last === undefined ? '-' : this.load(last);
      return [`- 판정: 한계에 닿지 않음 (최대 ${reached}까지 정상)`];
    }

    const previous = results.find((result) => result.window === failedWindow.window - 1);
    const lines = [
      `- 한계 용량: ${previous === undefined ? '측정 불가(첫 구간에서 고장)' : this.load(previous)}`,
      `- 고장 지점: ${this.load(failedWindow)} (${failedWindow.window}번째 구간)`,
      `- 처음 걸린 고장 기준: ${failedWindow.causes.join(', ')}`,
    ];
    if (failedWindow.causes.some((cause) => cause.startsWith('서버가 따라가지 못함'))) {
      lines.push('- 참고: 건너뛴 시나리오는 테스트 도구(러너)의 한계일 수도 있으므로 같은 시간대의 서버 지표와 함께 확인해야 합니다.');
    }
    return lines;
  }

  private windowTable(results: WindowResult[]): string[] {
    const rows = results.map((result) =>
      [
        result.window,
        result.endRate,
        this.format(result.rps, 1),
        this.format(result.p99),
        result.errorRate === undefined ? '-' : `${(result.errorRate * 100).toFixed(2)}%`,
        result.verdict,
      ].join(' | '),
    );
    return [
      '| 구간 | 구간 끝의 초당 시나리오 수 | 구간 평균 RPS(초당 요청 수) | 조회 응답 시간 p99(ms) | 서버 오류(5xx) 비율 | 판정 |',
      '| --- | --- | --- | --- | --- | --- |',
      ...rows.map((row) => `| ${row} |`),
      '',
      'RPS는 구간 안에서 보낸 요청 수를 구간 길이로 나눈 평균입니다. 구간 안에서 초당 시나리오 수가 계속 오르므로 구간 끝의 순간 값보다 낮게 나오고, 도중에 멈춘 구간은 더 낮게 나옵니다.',
    ];
  }

  private load(result: WindowResult): string {
    const rps = result.rps === undefined ? '-' : this.format(result.rps, 0);
    return `초당 ${result.endRate}개 시나리오 (구간 평균 ${rps} RPS)`;
  }
}
