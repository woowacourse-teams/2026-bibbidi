import type { SummaryData } from './summary.ts';

// API 하나의 응답 시간 평균만 보여 주는 보고서. p95·p99·최대값은 일부러 싣지 않는다.
export class AverageReport {
  constructor(
    private readonly data: SummaryData,
    private readonly api: string,
  ) {}

  files(directory: string): Record<string, string> {
    const markdown = this.toMarkdown();
    return {
      [`${directory}/summary.json`]: JSON.stringify(this.data, null, 2),
      [`${directory}/report.md`]: markdown,
      stdout: markdown,
    };
  }

  toMarkdown(): string {
    const failed = this.failedThresholds();
    const rows: [string, string][] = [
      ['api', `\`${this.api}\``],
      ['판정', failed.length === 0 ? '✅ 통과' : '❌ 실패'],
      ['실행 시간(초)', this.format((this.data.state?.testRunDurationMs ?? 0) / 1000, 0)],
      ['요청 수', this.format(this.value(`http_reqs{api:${this.api}}`, 'count'), 0)],
      ['응답 시간 평균(ms)', this.format(this.value(`http_req_duration{api:${this.api}}`, 'avg'))],
      ['서버 오류(5xx) 건수', this.format(this.value('server_errors', 'count') ?? 0, 0)],
      ['응답 검사 통과율', this.format(this.value('checks', 'rate'), 4)],
    ];
    const failures = failed.length === 0 ? [] : ['', '기준을 넘은 항목', ...failed.map((entry) => `- ${entry}`)];

    return ['## k6 결과: API 1개 평균', '', '| 항목 | 값 |', '| --- | --- |', ...rows.map(([name, cell]) => `| ${name} | ${cell} |`), ...failures, ''].join('\n');
  }

  private failedThresholds(): string[] {
    const failed: string[] = [];
    for (const [metric, summary] of Object.entries(this.data.metrics ?? {})) {
      for (const [expression, result] of Object.entries(summary.thresholds ?? {})) {
        if (!result.ok) {
          failed.push(`${metric}: ${expression}`);
        }
      }
    }
    return failed;
  }

  private value(metric: string, stat: string): number | undefined {
    return this.data.metrics?.[metric]?.values?.[stat];
  }

  private format(number: number | undefined, digits = 2): string {
    return number === undefined ? '-' : number.toFixed(digits);
  }
}
