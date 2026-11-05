import type { SummaryData } from '../report/summary.ts';
import { WindowedReport, type WindowResult } from './window-report.ts';
import type { WindowPlan } from './windows.ts';

export interface AiReportOptions {
  describeLoad: (perUnit: number) => string;
}

const DROPPED_CAUSE = '서버가 따라가지 못함(시작하지 못한 대화 발생)';

export class AiBreakpointReport extends WindowedReport {
  constructor(
    data: SummaryData,
    plan: WindowPlan,
    private readonly options: AiReportOptions,
  ) {
    super(data, plan);
  }

  protected title(): string {
    return 'k6 AI 채팅 Breakpoint 결과';
  }

  protected intro(): string {
    return `대화 1건은 새 사용자 한 명이 같은 대화로 질문을 이어서 보내는 것입니다. 질문 1번을 호출 1건으로 셉니다. ${this.options.describeLoad(this.plan.stepRate / this.plan.unitSeconds)}씩 ${this.plan.windowSeconds}초 구간마다 올립니다. 응답은 요청을 시작한 구간에 반영하고, 응답이 끝난 뒤 완료율을 판정하므로 중단이 구간 1~2개 늦을 수 있습니다.`;
  }

  protected columns(): string[] {
    return ['구간 끝의 부하', '시작한 질문 수', '완료율', '서버 오류(5xx) 비율', '응답 시간 평균(초)', '응답 시간 p95(초)', '첫 토큰 시간 평균(초)', '첫 토큰 시간 p95(초)'];
  }

  protected footnote(): string {
    return '완료율은 HTTP 200으로 응답하고 `done` 이벤트가 도착한 질문의 비율입니다. `failure` 이벤트, 오류 응답, 60초 초과는 미완료로 셉니다. 응답 시간과 첫 토큰 시간(TTFT, 요청에서 첫 `delta` 이벤트까지)은 판정 기준이 아니라 참고 값입니다.';
  }

  protected requestsMetric(): string {
    return 'window_ai_requests';
  }

  protected extraConclusion(failedWindow: WindowResult | undefined): string[] {
    const lines: string[] = [];
    if (failedWindow?.causes.includes(DROPPED_CAUSE)) {
      lines.push('- 참고: 시작하지 못한 대화는 테스트 도구(러너)의 한계일 수도 있으므로 같은 시간대의 서버 지표와 함께 확인해야 합니다.');
    }
    return lines;
  }

  protected windowResults(): WindowResult[] {
    const lastObserved = this.lastObservedWindow();
    const dropped = (this.value('dropped_iterations', 'count') ?? 0) > 0;

    return Array.from({ length: this.plan.windows }, (_, index) => {
      const window = index + 1;
      const requestCount = this.requestCount(window);
      const reached = requestCount > 0;
      const causes: string[] = [];

      if (this.hasFailedThreshold(`window_ai_completed{window:${window}}`)) causes.push('완료율이 90% 미만');
      if (this.hasFailedThreshold(`window_ai_server_error{window:${window}}`)) causes.push('서버 오류(5xx) 비율이 1% 초과');
      if (dropped && window === lastObserved) causes.push(DROPPED_CAUSE);

      const load = this.options.describeLoad(this.plan.perSecond(window));
      const completed = this.value(`window_ai_completed{window:${window}}`, 'rate');
      const errorRate = this.value(`window_ai_server_error{window:${window}}`, 'rate');
      const average = this.value(`window_ai_duration{window:${window}}`, 'avg');
      const p95 = this.value(`window_ai_duration{window:${window}}`, 'p(95)');
      const ttftAverage = this.value(`window_ai_ttft{window:${window}}`, 'avg');
      const ttftP95 = this.value(`window_ai_ttft{window:${window}}`, 'p(95)');

      return {
        window,
        load,
        cells: [
          load,
          reached ? String(requestCount) : '-',
          reached ? this.percent(completed) : '-',
          reached ? this.percent(errorRate) : '-',
          reached ? this.seconds(average) : '-',
          reached ? this.seconds(p95) : '-',
          reached ? this.seconds(ttftAverage) : '-',
          reached ? this.seconds(ttftP95) : '-',
        ],
        verdict: causes.length > 0 ? '고장' : reached ? '정상' : '도달 못함',
        causes,
      };
    });
  }

  private percent(rate: number | undefined): string {
    return rate === undefined ? '-' : `${(rate * 100).toFixed(1)}%`;
  }

  private seconds(milliseconds: number | undefined): string {
    return milliseconds === undefined ? '-' : (milliseconds / 1000).toFixed(1);
  }
}
