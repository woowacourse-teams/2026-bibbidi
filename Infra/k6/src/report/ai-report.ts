import { AI_OUTCOMES } from '../config/thresholds.ts';
import { SLO } from '../config/targets.ts';
import { SummaryReport, type SummaryData } from './summary.ts';

const OUTCOME_LABELS: Record<(typeof AI_OUTCOMES)[number], string> = {
  completed: '완료(done)',
  failure_event: '실패 안내(failure)',
  rejected: '거절(4xx)',
  disconnected: '무응답(200인데 완료도 실패 안내도 없음)',
  http_error: '서버 오류(5xx 또는 연결 실패)',
};

// AI 턴의 결과를 다섯 가지로 나눠 보여 주는 보고서. 무응답이 있으면 실패다.
export class AiOutcomeReport extends SummaryReport {
  constructor(
    data: SummaryData,
    private readonly title: string = 'AI 채팅 결과',
    private readonly intro: string = 'SSE 턴을 완료, 실패 안내, 거절, 무응답, 서버 오류로 나눠 셉니다.',
  ) {
    super(data);
  }

  toMarkdown(): string {
    return [`## ${this.title}`, '', `> ${this.intro}`, '', ...this.section(), ''].join('\n');
  }

  // 다른 보고서에 붙여 쓸 수 있도록 제목 없이 본문만 만든다.
  section(): string[] {
    const counts = AI_OUTCOMES.map((outcome) => ({ outcome, count: this.count(outcome) }));
    const total = counts.reduce((sum, entry) => sum + entry.count, 0);
    const silent = this.count('disconnected') + this.count('http_error');
    const completionRate = total === 0 ? undefined : this.count('completed') / total;
    // 실패 안내가 한 번도 없으면 지연 시간 통계는 의미가 없다(k6는 표본이 없으면 0을 준다).
    const failureP95 = this.count('failure_event') === 0 ? undefined : this.value('ai_failure_ms', 'p(95)');
    const failureOk = failureP95 === undefined || failureP95 < SLO.aiFailureResponseP95Ms;
    const passed = silent === 0 && failureOk && this.failedThresholds().length === 0;

    return [
      `- 판정: ${passed ? '✅ 무응답 0건' : '❌ 기준을 넘음'}`,
      `- 무응답·서버 오류: ${silent}건 (0건이어야 합니다)`,
      `- 턴 완료율: ${completionRate === undefined ? '-' : `${(completionRate * 100).toFixed(1)}%`} (실패 안내를 일부러 내는 테스트에서는 낮은 것이 정상입니다)`,
      `- 실패 안내가 오기까지 p95: ${failureP95 === undefined ? '-' : `${failureP95.toFixed(0)}ms`} (기준 ${SLO.aiFailureResponseP95Ms}ms 미만, 잠정)`,
      `- TTFT p95(참고, 판정에 쓰지 않음): ${this.format(this.value('ai_ttft_ms', 'p(95)'), 0)}ms (참고 ${SLO.aiTtftP95Ms}ms)`,
      '',
      '| 결과 | 횟수 |',
      '| --- | ---: |',
      ...counts.map((entry) => `| ${OUTCOME_LABELS[entry.outcome]} | ${entry.count} |`),
      `| 전체 | ${total} |`,
      ...this.failedLines(),
    ];
  }

  private count(outcome: string): number {
    return this.value(`ai_turns{outcome:${outcome}}`, 'count') ?? 0;
  }

  private failedLines(): string[] {
    const failed = this.failedThresholds();
    return failed.length === 0 ? [] : ['', '기준을 넘은 항목', ...failed.map((entry) => `- ${entry}`)];
  }
}
