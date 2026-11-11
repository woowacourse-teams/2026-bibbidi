import { generalMetric } from '../config/thresholds.ts';
import { SLO } from '../config/targets.ts';
import { AiOutcomeReport } from './ai-report.ts';
import { GeneralSloReport, type ReportGroup } from './general-report.ts';
import { SummaryReport, type SummaryData } from './summary.ts';

export const ISOLATION_GROUPS: readonly ReportGroup[] = [
  { label: 'AI 투입 전(before)', tags: 'phase:before', p95: true, failure: true },
  { label: 'AI 투입 중(during)', tags: 'phase:during', p95: true, failure: true },
  { label: 'AI 투입 후(after)', tags: 'phase:after', p95: true, failure: true },
];

// AI 대화가 몰릴 때 일반 API가 느려지는지 본다. 투입 중 p95가 투입 전의 몇 배인지가 합격 기준이다.
export class IsolationReport extends SummaryReport {
  private readonly general: GeneralSloReport;
  private readonly ai: AiOutcomeReport;

  constructor(data: SummaryData) {
    super(data);
    this.general = new GeneralSloReport(data, '일반 API 응답 시간', '구간별 일반 API 응답입니다.', ISOLATION_GROUPS);
    this.ai = new AiOutcomeReport(data);
  }

  // 투입 전·중 구간에 요청이 없어 비율을 구하지 못하면 통과로 보지 않는다.
  verdict(): { ratio: number | undefined; passed: boolean } {
    const before = this.value(generalMetric('http_req_duration', 'phase:before'), 'p(95)');
    const during = this.value(generalMetric('http_req_duration', 'phase:during'), 'p(95)');
    const ratio = before === undefined || during === undefined || before === 0 ? undefined : during / before;
    return { ratio, passed: ratio !== undefined && ratio <= SLO.isolationRatio };
  }

  // k6 임계값은 구간끼리 비교할 수 없어서 비율은 판정 파일로 내보내고, 워크플로가 이 파일로 잡을 실패시킨다.
  files(directory: string): Record<string, string> {
    const { ratio, passed } = this.verdict();
    return {
      ...super.files(directory),
      [`${directory}/verdict.json`]: JSON.stringify({ script: 'ai-isolation-test', passed, ratio: ratio ?? null, limit: SLO.isolationRatio }),
    };
  }

  toMarkdown(): string {
    const { ratio, passed: ok } = this.verdict();

    return [
      '## AI 부하 중 일반 API 격리',
      '',
      `> AI 투입 중 일반 API p95가 투입 전의 ${SLO.isolationRatio}배 이하여야 합니다.`,
      '',
      `- 판정: ${ratio === undefined ? '측정 불가(구간에 요청이 없음)' : ok ? '✅ 격리됨' : '❌ AI 부하가 일반 API를 늦춤'}`,
      `- p95 비율(투입 중 ÷ 투입 전): ${ratio === undefined ? '-' : ratio.toFixed(2)}배`,
      '',
      ...this.general.body(),
      '',
      '### AI 결과',
      '',
      ...this.ai.section(),
      '',
    ].join('\n');
  }
}
