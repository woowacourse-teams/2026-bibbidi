import { SummaryReport } from './summary.ts';

export class AiSmokeReport extends SummaryReport {
  protected extraRows(): [string, string][] {
    const requests = this.value('window_ai_requests{window:1}', 'count');
    const completed = this.value('window_ai_completed{window:1}', 'rate');
    return [
      ['AI 질문 수', this.format(requests, 0)],
      ['AI 완료율', completed === undefined ? '-' : `${(completed * 100).toFixed(1)}%`],
      ['AI 응답 시간 평균(초)', this.seconds(this.value('window_ai_duration{window:1}', 'avg'))],
      ['첫 토큰 시간(TTFT) 평균(초)', this.seconds(this.value('window_ai_ttft{window:1}', 'avg'))],
    ];
  }

  private seconds(milliseconds: number | undefined): string {
    return milliseconds === undefined ? '-' : (milliseconds / 1000).toFixed(1);
  }
}
