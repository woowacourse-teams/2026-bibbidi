import { check } from 'k6';
import http, { type RefinedResponse } from 'k6/http';
import { Counter } from 'k6/metrics';
import type { TagProvider } from '../config/shape.ts';

export const serverErrors = new Counter('server_errors');
// 엔드포인트별로 어떤 상태 코드가 몇 번 왔는지. 상태 0은 연결 실패·시간 초과다.
export const responses = new Counter('responses');

// name 태그에는 공백과 중괄호가 들어 있어 임계값 식의 태그 값으로 쓸 수 없다. 엔드포인트별 판정은 이 태그로 나눈다.
export function endpointTag(name: string): string {
  return name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export interface RequestSpec {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  // 문자열 본문을 JSON 따옴표 없이 그대로 보낸다. 제목·상태 변경 API는 본문 전체가 값이다.
  rawBody?: boolean;
  expected: readonly number[];
  // 기본은 general. 일부러 4xx를 받는 요청은 따로 태그해 일반 API 판정에서 뺀다.
  kind?: string;
}

// 일반 API 요청에는 kind=general 태그를 붙여, SSE로 오래 열리는 AI 요청과 응답 시간을 따로 판정한다.
// 주의: http.batch는 요청별 responseCallback을 적용하지 않아, 배치 안의 기대한 4xx도 http_req_failed로 센다.
export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly extraTags: TagProvider = () => ({}),
  ) {}

  send(token: string | null, spec: RequestSpec): RefinedResponse<'text'> {
    const response = http.request(
      spec.method,
      `${this.baseUrl}${spec.path}`,
      this.serialize(spec),
      this.params(token, spec),
    );
    this.verify(spec, response);
    return response;
  }

  // 홈처럼 한 화면이 API 여러 개를 동시에 부를 때 쓴다.
  sendBatch(token: string | null, specs: readonly RequestSpec[]): RefinedResponse<'text'>[] {
    const responses = http.batch(
      specs.map((spec) => ({
        method: spec.method,
        url: `${this.baseUrl}${spec.path}`,
        body: this.serialize(spec),
        params: this.params(token, spec),
      })),
    ) as RefinedResponse<'text'>[];
    responses.forEach((response, index) => this.verify(specs[index], response));
    return responses;
  }

  private serialize(spec: RequestSpec): string | null {
    if (spec.body === undefined) {
      return null;
    }
    return spec.rawBody && typeof spec.body === 'string' ? spec.body : JSON.stringify(spec.body);
  }

  private params(token: string | null, spec: RequestSpec) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token !== null) {
      headers.Authorization = `Bearer ${token}`;
    }
    return {
      headers,
      tags: { kind: spec.kind ?? 'general', ...this.extraTags(), name: spec.name, endpoint: endpointTag(spec.name) },
      responseCallback: http.expectedStatuses(...spec.expected),
    };
  }

  private verify(spec: RequestSpec, response: RefinedResponse<'text'>): void {
    if (response.status >= 500) {
      serverErrors.add(1);
    }
    if ((spec.kind ?? 'general') === 'general') {
      responses.add(1, { endpoint: endpointTag(spec.name), code: String(response.status) });
    }
    check(response, {
      [`${spec.name} -> ${spec.expected.join('|')}`]: (r) => spec.expected.includes(r.status),
    });
  }
}
