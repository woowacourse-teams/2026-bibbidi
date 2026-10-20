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

export class WorstCaseReport extends GeneralSloReport {
  body(): string[] {
    return [...super.body(), '', ...this.statusTable()];
  }

  private statusTable(): string[] {
    const rows = this.endpoints.map(({ label, endpoint }) => {
      const counts = STATUS_CODES.map((code) => [code, this.value(responseMetric(endpoint, code), 'count') ?? 0] as const)
        .filter(([, count]) => count > 0)
        .map(([code, count]) => `${code === 0 ? '연결 실패' : code}×${count}`);
      return `| ${label} | ${counts.length === 0 ? '-' : counts.join(', ')} |`;
    });
    return ['### 엔드포인트별 상태 코드', '', '| 엔드포인트 | 상태 코드 ×횟수 |', '| --- | --- |', ...rows];
  }

  private endpoints: readonly EndpointLabel[] = [];

  withEndpoints(endpoints: readonly EndpointLabel[]): this {
    this.endpoints = endpoints;
    return this;
  }
}
