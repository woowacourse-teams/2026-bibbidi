import exec from 'k6/execution';
import type { Options } from 'k6/options';
import { ApiFactory } from '../api/api.ts';
import { AccessTokenIssuer } from '../common/token.ts';
import { Environment, numberFromEnv, textFromEnv } from '../common/environment.ts';
import { HttpClient } from '../http/http.ts';
import type { SummaryData } from '../report/summary.ts';
import { AverageReport } from '../report/average-report.ts';
import { ReturningUserPool, UserIds } from '../session/users.ts';
import type { SetupData } from '../session/session.ts';
import type { AverageTarget } from './targets.ts';

// API 하나를 일정한 속도로 호출해 응답 시간 평균만 구한다.
export class AverageRun {
  private readonly environment = Environment.fromEnv();
  private readonly client = new HttpClient(this.environment.baseUrl);
  private readonly tokens = new AccessTokenIssuer(this.environment);
  private readonly apis = new ApiFactory(this.client, this.tokens);

  constructor(private readonly target: AverageTarget) {}

  options(): Options {
    const api = this.target.path;
    return {
      scenarios: {
        average: {
          executor: 'constant-arrival-rate',
          rate: numberFromEnv('RATE', 1),
          timeUnit: '1s',
          duration: textFromEnv('DURATION', '1m'),
          preAllocatedVUs: numberFromEnv('PRE_ALLOCATED_VUS', 5),
          maxVUs: numberFromEnv('MAX_VUS', 20),
        },
      },
      thresholds: {
        checks: ['rate==1'],
        server_errors: ['count==0'],
        // 하위 지표는 임계값이 있어야 요약에 나온다. 항상 통과하는 식으로 api 태그별 값을 꺼낸다.
        [`http_req_duration{api:${api}}`]: ['avg>=0'],
        [`http_reqs{api:${api}}`]: ['count>=0'],
      },
      setupTimeout: '2m',
      summaryTrendStats: ['avg'],
    };
  }

  setup(): SetupData {
    const catalogItemIds = this.apis.forUser(UserIds.pooled(0)).catalogItemIds();
    return {
      runId: Math.floor(Date.now() / 1000),
      catalogItemIds,
      pool: new ReturningUserPool(this.apis, this.target.poolSize).prepare(catalogItemIds),
    };
  }

  run(data: SetupData): void {
    this.target.call({
      client: this.client,
      tokens: this.tokens,
      apis: this.apis,
      data,
      iteration: exec.scenario.iterationInTest,
    });
  }

  summary(data: SummaryData): Record<string, string> {
    return new AverageReport(data, this.target.path).files(textFromEnv('SUMMARY_DIR', '.'));
  }
}
