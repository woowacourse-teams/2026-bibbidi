import type { ApiFactory } from '../api/api.ts';
import type { AccessTokenIssuer } from '../common/token.ts';
import type { HttpClient } from '../http/http.ts';
import { pickRandom, UserIds } from '../session/users.ts';
import type { SetupData } from '../session/session.ts';
import { numberFromEnv } from '../common/environment.ts';

export interface TargetContext {
  client: HttpClient;
  tokens: AccessTokenIssuer;
  apis: ApiFactory;
  data: SetupData;
  iteration: number;
}

// 한 번의 실행에서 재는 API 하나. path는 요청의 api 태그 값이다.
export interface AverageTarget {
  readonly path: string;
  readonly poolSize: number;
  call(context: TargetContext): void;
}

export const catalogTarget: AverageTarget = {
  path: '/api/catalog',
  poolSize: 0,
  call({ client, tokens }) {
    client.send(tokens.issue(UserIds.pooled(0)), {
      name: 'GET /api/catalog',
      method: 'GET',
      path: '/api/catalog',
      expected: [200],
      tags: { api: '/api/catalog' },
    });
  },
};

export const checklistTarget: AverageTarget = {
  path: '/api/checklists/me',
  poolSize: numberFromEnv('POOL_SIZE', 10),
  call({ client, tokens, data, iteration }) {
    const user = data.pool[iteration % data.pool.length];
    client.send(tokens.issue(user.userId), {
      name: 'GET /api/checklists/me',
      method: 'GET',
      path: '/api/checklists/me',
      expected: [200],
      tags: { api: '/api/checklists/me' },
    });
  },
};

// 같은 항목을 두 번 담으면 실패하므로, 요청마다 새 사용자의 빈 체크리스트에 담는다.
// 체크리스트 생성은 준비 단계라서 api 태그를 붙이지 않는다.
export const addCatalogItemsTarget: AverageTarget = {
  path: '/api/checklists/me/catalog-items',
  poolSize: 0,
  call({ client, tokens, apis, data, iteration }) {
    const userId = UserIds.fresh(data.runId, iteration);
    apis.forUser(userId).createChecklist();
    client.send(tokens.issue(userId), {
      name: 'POST /api/checklists/me/catalog-items',
      method: 'POST',
      path: '/api/checklists/me/catalog-items',
      body: pickRandom(data.catalogItemIds, numberFromEnv('ITEM_COUNT', 3)),
      expected: [201],
      tags: { api: '/api/checklists/me/catalog-items' },
    });
  },
};
