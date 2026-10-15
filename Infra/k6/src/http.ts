import { check } from 'k6';
import http, { type RefinedResponse } from 'k6/http';
import { Counter } from 'k6/metrics';

export const serverErrors = new Counter('server_errors');

export interface RequestSpec {
  // 지표의 name 태그. 경로 변수는 {id}처럼 묶어 시계열 수를 제한한다.
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  // 이 요청이 정상으로 보는 상태 코드
  expected: readonly number[];
}

// 테스트마다 정상 응답의 기준이 다르다. 예: Spike는 요청 제한으로 429가 나와도 정상이다.
export interface ExpectationPolicy {
  acceptable(spec: RequestSpec): number[];
}

export class StrictExpectation implements ExpectationPolicy {
  acceptable(spec: RequestSpec): number[] {
    return [...spec.expected];
  }
}

export class ExpectationWithExtras implements ExpectationPolicy {
  constructor(private readonly extraStatuses: readonly number[]) {}

  acceptable(spec: RequestSpec): number[] {
    return [...spec.expected, ...this.extraStatuses];
  }
}

// 요청마다 붙일 추가 태그. 예: Breakpoint가 현재 구간을 태그로 붙인다.
export type TagProvider = () => Record<string, string>;

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly expectation: ExpectationPolicy = new StrictExpectation(),
    private readonly extraTags: TagProvider = () => ({}),
  ) {}

  send(token: string, spec: RequestSpec): RefinedResponse<'text'> {
    const acceptable = this.expectation.acceptable(spec);
    const response = http.request(
      spec.method,
      `${this.baseUrl}${spec.path}`,
      spec.body === undefined ? null : JSON.stringify(spec.body),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        tags: { ...this.extraTags(), name: spec.name },
        responseCallback: http.expectedStatuses(...acceptable),
      },
    );

    if (response.status >= 500) {
      serverErrors.add(1);
    }
    check(response, {
      [`${spec.name} -> ${acceptable.join('|')}`]: (r) => acceptable.includes(r.status),
    });

    return response;
  }
}
