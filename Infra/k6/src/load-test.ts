import exec from 'k6/execution';
import type { ApiFactory } from './api.ts';
import type { SessionMix, SetupData } from './session.ts';
import { UserIds, ReturningUserPool } from './users.ts';

// 테스트 종류와 관계없는 실행 틀. setup()에서 데이터를 준비하고, 반복마다 세션 하나를 골라 실행한다.
// 도착률, 임계값, 세션 구성은 각 테스트 파일이 정한다.
export class LoadTest {
  private readonly pool: ReturningUserPool;

  constructor(
    private readonly apis: ApiFactory,
    private readonly mix: SessionMix,
    poolSize: number,
  ) {
    this.pool = new ReturningUserPool(apis, poolSize);
  }

  setup(): SetupData {
    const catalogItemIds = this.apis.forUser(UserIds.pooled(0)).catalogItemIds();
    return {
      runId: Math.floor(Date.now() / 1000),
      catalogItemIds,
      pool: this.pool.prepare(catalogItemIds),
    };
  }

  run(data: SetupData): void {
    this.mix.pick().run({ data, iteration: exec.scenario.iterationInTest, apis: this.apis });
  }
}
