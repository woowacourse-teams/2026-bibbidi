import exec from 'k6/execution';
import type { ApiFactory } from '../api/api.ts';
import { POOL_SIZE, REFRESH_TOKEN_COUNT } from '../config/targets.ts';
import type { Session, SessionSelector, SetupData } from '../session/session.ts';
import { ReturningUserPool, UserIds } from '../session/users.ts';

// setup()에서 카탈로그와 재방문 사용자 풀을 준비하고, 시나리오마다 세션 하나를 실행한다.
export class LoadTest {
  private readonly pool: ReturningUserPool;

  constructor(
    private readonly apis: ApiFactory,
    poolSize: number = POOL_SIZE,
  ) {
    this.pool = new ReturningUserPool(apis, poolSize);
  }

  setup(): SetupData {
    const catalogItemIds = this.apis.forUser(UserIds.pooled(0)).catalogItemIds();
    return {
      runId: Math.floor(Date.now() / 1000),
      catalogItemIds,
      pool: this.pool.prepare(catalogItemIds),
      refreshTokenCount: REFRESH_TOKEN_COUNT,
    };
  }

  // AI 전용 테스트는 카탈로그와 재방문 풀이 필요 없다.
  setupRunOnly(): SetupData {
    return { runId: Math.floor(Date.now() / 1000), catalogItemIds: [], pool: [], refreshTokenCount: 0 };
  }

  // 시나리오 안의 반복 번호를 그대로 쓴다. 신규 사용자 ID와 리프레시 토큰이 시나리오마다 겹치지 않는다.
  run(session: Session, data: SetupData): void {
    session.run({ data, iteration: exec.scenario.iterationInTest, apis: this.apis });
  }

  runSelected(selector: SessionSelector, data: SetupData): void {
    const iteration = exec.scenario.iterationInTest;
    selector.pick(iteration).run({ data, iteration, apis: this.apis });
  }
}
