import { SummaryReport, type SummaryData } from '../report/summary.ts';
import type { WindowPlan } from './windows.ts';

export type WindowVerdict = '정상' | '고장' | '도달 못함';

export interface WindowResult {
  window: number;
  load: string;
  cells: string[];
  verdict: WindowVerdict;
  causes: string[];
}

export abstract class WindowedReport extends SummaryReport {
  constructor(
    data: SummaryData,
    protected readonly plan: WindowPlan,
  ) {
    super(data);
  }

  protected abstract title(): string;
  protected abstract intro(): string;
  protected abstract columns(): string[];
  protected abstract footnote(): string;
  protected abstract requestsMetric(): string;
  protected abstract windowResults(): WindowResult[];

  protected extraConclusion(_failedWindow: WindowResult | undefined): string[] {
    return [];
  }

  toMarkdown(): string {
    const results = this.windowResults();
    const failedWindow = results.find((result) => result.verdict === '고장');

    return [
      `## ${this.title()}`,
      '',
      `> ${this.intro()}`,
      '',
      ...this.conclusion(results, failedWindow),
      ...this.extraConclusion(failedWindow),
      '',
      ...this.windowTable(results),
      '',
      '### 전체 요약',
      '',
      ...this.overview(failedWindow === undefined),
      '',
    ].join('\n');
  }

  protected requestCount(window: number): number {
    return this.value(`${this.requestsMetric()}{window:${window}}`, 'count') ?? 0;
  }

  protected lastObservedWindow(): number {
    let last = 0;
    for (let window = 1; window <= this.plan.windows; window += 1) {
      if (this.requestCount(window) > 0) {
        last = window;
      }
    }
    return last;
  }

  protected hasFailedThreshold(metricName: string): boolean {
    return Object.values(this.metric(metricName)?.thresholds ?? {}).some((result) => !result.ok);
  }

  private conclusion(results: WindowResult[], failedWindow: WindowResult | undefined): string[] {
    if (failedWindow === undefined) {
      const last = results.filter((result) => result.verdict === '정상').pop();
      return [`- 판정: 한계에 닿지 않음 (최대 ${last === undefined ? '-' : last.load}까지 정상)`];
    }

    const previous = results.find((result) => result.window === failedWindow.window - 1);
    return [
      `- 한계 용량: ${previous === undefined ? '측정 불가(첫 구간에서 고장)' : previous.load}`,
      `- 고장 지점: ${failedWindow.load} (${failedWindow.window}번째 구간)`,
      `- 처음 걸린 고장 기준: ${failedWindow.causes.join(', ')}`,
    ];
  }

  private windowTable(results: WindowResult[]): string[] {
    const columns = ['구간', ...this.columns(), '판정'];
    const rows = results.map((result) => [result.window, ...result.cells, result.verdict].join(' | '));
    return [
      `| ${columns.join(' | ')} |`,
      `| ${columns.map(() => '---').join(' | ')} |`,
      ...rows.map((row) => `| ${row} |`),
      '',
      this.footnote(),
    ];
  }
}
