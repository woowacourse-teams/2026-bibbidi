import { WindowedReport, type WindowResult } from './window-report.ts';

const DROPPED_CAUSE = '서버가 따라가지 못함(건너뛴 시나리오 발생)';

export class BreakpointReport extends WindowedReport {
  protected title(): string {
    return 'k6 Breakpoint 결과';
  }

  protected intro(): string {
    return `시나리오 1건은 사용자 한 명이 사용 흐름을 한 번 끝까지 지나가는 것입니다. 신규 사용자는 둘러보기, 체크리스트 담기, 일정 잡기, 홈 순서이고 재방문 사용자는 홈, 일정 완료 순서입니다. 초당 시나리오 수를 ${this.plan.windowSeconds}초 구간마다 ${this.plan.stepRate}씩 올립니다.`;
  }

  protected columns(): string[] {
    return ['구간 끝의 초당 시나리오 수', '구간 평균 RPS(초당 요청 수)', '조회 응답 시간 p99(ms)', '서버 오류(5xx) 비율'];
  }

  protected footnote(): string {
    return 'RPS는 구간 안에서 보낸 요청 수를 구간 길이로 나눈 평균입니다. 구간 안에서 초당 시나리오 수가 계속 오르므로 구간 끝의 순간 값보다 낮게 나오고, 도중에 멈춘 구간은 더 낮게 나옵니다.';
  }

  protected requestsMetric(): string {
    return 'window_requests';
  }

  protected extraConclusion(failedWindow: WindowResult | undefined): string[] {
    if (failedWindow?.causes.includes(DROPPED_CAUSE)) {
      return ['- 참고: 건너뛴 시나리오는 테스트 도구(러너)의 한계일 수도 있으므로 같은 시간대의 서버 지표와 함께 확인해야 합니다.'];
    }
    return [];
  }

  protected windowResults(): WindowResult[] {
    const lastObserved = this.lastObservedWindow();
    const dropped = (this.value('dropped_iterations', 'count') ?? 0) > 0;

    return Array.from({ length: this.plan.windows }, (_, index) => {
      const window = index + 1;
      const requestCount = this.requestCount(window);
      const reached = requestCount > 0;
      const latency = this.metric(`window_latency{window:${window}}`);
      const errors = this.metric(`window_server_error{window:${window}}`);
      const causes: string[] = [];

      if (this.hasFailedThreshold(`window_latency{window:${window}}`)) causes.push('조회 응답 시간(p99)이 1초 초과');
      if (this.hasFailedThreshold(`window_server_error{window:${window}}`)) causes.push('서버 오류(5xx) 비율이 1% 초과');
      if (dropped && window === lastObserved) causes.push(DROPPED_CAUSE);

      const rps = reached ? requestCount / this.plan.windowSeconds : undefined;
      const errorRate = reached ? errors?.values?.rate : undefined;
      return {
        window,
        load: `초당 ${this.plan.endRate(window)}개 시나리오 (구간 평균 ${rps === undefined ? '-' : this.format(rps, 0)} RPS)`,
        cells: [
          String(this.plan.endRate(window)),
          this.format(rps, 1),
          this.format(reached ? latency?.values?.['p(99)'] : undefined),
          errorRate === undefined ? '-' : `${(errorRate * 100).toFixed(2)}%`,
        ],
        verdict: causes.length > 0 ? '고장' : reached ? '정상' : '도달 못함',
        causes,
      };
    });
  }
}
