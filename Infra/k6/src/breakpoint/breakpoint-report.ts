import { SummaryReport, type SummaryData } from '../report/summary.ts';
import type { WindowPlan } from './windows.ts';

type WindowVerdict = '정상' | '고장' | '미도달';

interface WindowResult {
  window: number;
  endRate: number;
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
      const reached = (this.value(`window_requests{window:${window}}`, 'count') ?? 0) > 0;
      const causes: string[] = [];

      if (this.hasFailedThreshold(latency)) causes.push('조회 p99 > 1초');
      if (this.hasFailedThreshold(errors)) causes.push('5xx 비율 > 1%');
      if (dropped && window === lastObserved) causes.push('처리량 포화(누락된 세션)');

      return {
        window,
        endRate: this.plan.endRate(window),
        p99: reached ? latency?.values?.['p(99)'] : undefined,
        errorRate: reached ? errors?.values?.rate : undefined,
        verdict: causes.length > 0 ? '고장' : reached ? '정상' : '미도달',
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
      const reached = last === undefined ? '-' : String(last.endRate);
      return [`- 판정: 한계 미도달 (최대 ${reached}세션/초까지 정상)`];
    }

    const previous = results.find((result) => result.window === failedWindow.window - 1);
    return [
      `- 한계 용량: ${previous === undefined ? '측정 불가(첫 윈도우에서 고장)' : `${previous.endRate}세션/초`}`,
      `- 고장 지점: ${failedWindow.endRate}세션/초 (윈도우 ${failedWindow.window})`,
      `- 처음 걸린 고장 기준: ${failedWindow.causes.join(', ')}`,
    ];
  }

  private windowTable(results: WindowResult[]): string[] {
    const rows = results.map((result) =>
      [
        result.window,
        result.endRate,
        this.format(result.p99),
        result.errorRate === undefined ? '-' : `${(result.errorRate * 100).toFixed(2)}%`,
        result.verdict,
      ].join(' | '),
    );
    return ['| 윈도우 | 끝 도착률(세션/초) | 조회 p99(ms) | 5xx 비율 | 판정 |', '| --- | --- | --- | --- | --- |', ...rows.map((row) => `| ${row} |`)];
  }
}
