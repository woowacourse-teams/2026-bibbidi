export interface ThresholdResult {
  ok: boolean;
}

export interface MetricSummary {
  values?: Record<string, number>;
  thresholds?: Record<string, ThresholdResult>;
}

export interface SummaryData {
  metrics?: Record<string, MetricSummary>;
  state?: { testRunDurationMs?: number };
}

export class SummaryReport {
  constructor(protected readonly data: SummaryData) {}

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
    const failures = failed.length === 0 ? [] : ['', '기준을 넘은 항목', ...failed.map((entry) => `- ${entry}`)];

    return [`## k6 결과: ${failed.length === 0 ? '통과' : '실패'}`, '', ...this.overview(failed.length === 0), ...failures, ''].join('\n');
  }

  files(directory: string): Record<string, string> {
    const markdown = this.toMarkdown();
    return {
      [`${directory}/summary.json`]: JSON.stringify(this.data, null, 2),
      [`${directory}/report.md`]: markdown,
      stdout: markdown,
    };
  }

  protected overview(passed: boolean): string[] {
    const durationSeconds = (this.data.state?.testRunDurationMs ?? 0) / 1000;

    const rows: [string, string][] = [
      ['판정', passed ? '✅ 통과' : '❌ 실패'],
      ['실행 시간(초)', this.format(durationSeconds, 0)],
      ['요청 수', this.format(this.value('http_reqs', 'count'), 0)],
      ['초당 요청 수', this.format(this.value('http_reqs', 'rate'))],
      ['처리한 시나리오 수', this.format(this.value('iterations', 'count'), 0)],
      ['응답 검사 통과율', this.format(this.value('checks', 'rate'), 4)],
      ['서버 오류(5xx) 건수', this.format(this.value('server_errors', 'count') ?? 0, 0)],
      ['응답 시간 평균(ms)', this.format(this.value('http_req_duration', 'avg'))],
      ['응답 시간 p95(ms, 느린 5% 경계)', this.format(this.value('http_req_duration', 'p(95)'))],
      ['응답 시간 p99(ms, 느린 1% 경계)', this.format(this.value('http_req_duration', 'p(99)'))],
      ['응답 시간 최대(ms)', this.format(this.value('http_req_duration', 'max'))],
      ['건너뛴 시나리오 수(dropped_iterations)', this.format(this.value('dropped_iterations', 'count') ?? 0, 0)],
      ...this.extraRows(),
    ];

    return ['| 항목 | 값 |', '| --- | --- |', ...rows.map(([name, cell]) => `| ${name} | ${cell} |`)];
  }

  protected extraRows(): [string, string][] {
    return [];
  }

  protected value(metric: string, stat: string): number | undefined {
    return this.data.metrics?.[metric]?.values?.[stat];
  }

  protected metric(name: string): MetricSummary | undefined {
    return this.data.metrics?.[name];
  }

  protected format(number: number | undefined, digits = 2): string {
    return number === undefined ? '-' : number.toFixed(digits);
  }
}
