interface ThresholdResult {
  ok: boolean;
}

interface MetricSummary {
  values?: Record<string, number>;
  thresholds?: Record<string, ThresholdResult>;
}

export interface SummaryData {
  metrics?: Record<string, MetricSummary>;
  state?: { testRunDurationMs?: number };
}

export class SummaryReport {
  constructor(private readonly data: SummaryData) {}

  failedThresholds(): string[] {
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

  toMarkdown(): string {
    const failed = this.failedThresholds();
    const durationSeconds = (this.data.state?.testRunDurationMs ?? 0) / 1000;

    const rows: [string, string][] = [
      ['판정', failed.length === 0 ? '✅ 통과' : '❌ 실패'],
      ['실행 시간(초)', this.format(durationSeconds, 0)],
      ['요청 수', this.format(this.value('http_reqs', 'count'), 0)],
      ['요청/초', this.format(this.value('http_reqs', 'rate'))],
      ['세션(반복) 수', this.format(this.value('iterations', 'count'), 0)],
      ['체크 통과율', this.format(this.value('checks', 'rate'), 4)],
      ['5xx 건수', this.format(this.value('server_errors', 'count') ?? 0, 0)],
      ['응답 시간 avg(ms)', this.format(this.value('http_req_duration', 'avg'))],
      ['응답 시간 p(95)(ms)', this.format(this.value('http_req_duration', 'p(95)'))],
      ['응답 시간 p(99)(ms)', this.format(this.value('http_req_duration', 'p(99)'))],
      ['응답 시간 max(ms)', this.format(this.value('http_req_duration', 'max'))],
      ['누락된 반복(dropped_iterations)', this.format(this.value('dropped_iterations', 'count') ?? 0, 0)],
    ];

    const table = ['| 항목 | 값 |', '| --- | --- |', ...rows.map(([name, cell]) => `| ${name} | ${cell} |`)];
    const failures = failed.length === 0 ? [] : ['', '실패한 임계값', ...failed.map((entry) => `- ${entry}`)];

    return [`## k6 결과: ${failed.length === 0 ? '통과' : '실패'}`, '', ...table, ...failures, ''].join('\n');
  }

  files(directory: string): Record<string, string> {
    const markdown = this.toMarkdown();
    return {
      [`${directory}/summary.json`]: JSON.stringify(this.data, null, 2),
      [`${directory}/report.md`]: markdown,
      stdout: markdown,
    };
  }

  private value(metric: string, stat: string): number | undefined {
    return this.data.metrics?.[metric]?.values?.[stat];
  }

  private format(number: number | undefined, digits = 2): string {
    return number === undefined ? '-' : number.toFixed(digits);
  }
}
