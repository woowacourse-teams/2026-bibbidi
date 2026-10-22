import { generalMetric } from '../config/thresholds.ts';
import { GeneralSloReport } from './general-report.ts';

// 엔드포인트별로 받은 상태 코드. 임계값에 선언한 코드만 요약에 나타나므로 STATUS_CODES와 같은 목록을 쓴다.
export const STATUS_CODES = [200, 201, 204, 400, 401, 403, 404, 409, 429, 500, 502, 503, 504, 0] as const;

export function responseMetric(endpoint: string, code: number): string {
  return `responses{endpoint:${endpoint},code:${code}}`;
}

export interface EndpointLabel {
  label: string;
  endpoint: string;
}

// 합격 기준 없이 부하 정도만 기록하는 보고서. 기준·판정 문구는 빼고 상태 코드 표를 붙인다.
export class WorstCaseReport extends GeneralSloReport {
  toMarkdown(): string {
    return [`## ${this.title}`, '', `> ${this.intro}`, '', ...this.body(), '', '### 전체 요약', '', ...this.overview(true), ''].join('\n');
  }

  body(): string[] {
    const lines = super.body().filter((line) => !line.startsWith('기준:') && !line.startsWith('여러 탭'));
    return [...lines, '', ...this.statusTable()];
  }

  protected overview(passed: boolean): string[] {
    return super.overview(passed).filter((line) => !line.startsWith('| 판정'));
  }

  private statusTable(): string[] {
    const rows = this.endpoints.map(({ label, endpoint }) => {
      const total = this.value(generalMetric('http_reqs', `endpoint:${endpoint}`), 'count') ?? 0;
      const counts = STATUS_CODES.map((code) => [code, this.value(responseMetric(endpoint, code), 'count') ?? 0] as const)
        .filter(([, count]) => count > 0)
        .map(([code, count]) => {
          const percentage = total > 0 ? `${(count / total * 100).toFixed(3)}%` : '비율 산출 불가';
          const rate = this.includeStatusRates ? ` (${percentage})` : '';
          return `${code === 0 ? '연결 실패' : code}×${count}${rate}`;
        });
      return `| ${label} | ${counts.length === 0 ? '-' : counts.join(', ')} |`;
    });
    const column = this.includeStatusRates ? '상태 코드 ×횟수 (전체 요청 대비 비율)' : '상태 코드 ×횟수';
    return ['### 엔드포인트별 상태 코드', '', `| 엔드포인트 | ${column} |`, '| --- | --- |', ...rows];
  }

  private endpoints: readonly EndpointLabel[] = [];
  private includeStatusRates = false;

  withEndpoints(endpoints: readonly EndpointLabel[]): this {
    this.endpoints = endpoints;
    return this;
  }

  withStatusRates(): this {
    this.includeStatusRates = true;
    return this;
  }
}
