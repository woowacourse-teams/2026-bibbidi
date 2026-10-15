import exec from 'k6/execution';
import type { ApiFactory } from './api.ts';
import type { SessionSelector, SetupData } from './session.ts';
import { UserIds, ReturningUserPool } from './users.ts';

export class LoadTest {
  private readonly pool: ReturningUserPool;

  constructor(
    private readonly apis: ApiFactory,
    private readonly selector: SessionSelector,
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
    const iteration = exec.scenario.iterationInTest;
    this.selector.pick(iteration).run({ data, iteration, apis: this.apis });
  }
}
