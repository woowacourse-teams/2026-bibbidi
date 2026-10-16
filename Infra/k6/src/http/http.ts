import { check } from 'k6';
import http, { type RefinedResponse } from 'k6/http';
import { Counter } from 'k6/metrics';

export const serverErrors = new Counter('server_errors');

export interface RequestSpec {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  expected: readonly number[];
}

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

export type TagProvider = () => Record<string, string>;

export interface ResponseObserver {
  observe(spec: RequestSpec, response: RefinedResponse<'text'>): void;
}

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly expectation: ExpectationPolicy = new StrictExpectation(),
    private readonly extraTags: TagProvider = () => ({}),
    private readonly observers: readonly ResponseObserver[] = [],
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

    for (const observer of this.observers) {
      observer.observe(spec, response);
    }

    return response;
  }
}
