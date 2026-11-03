import exec from 'k6/execution';
import type { AccessTokenIssuer } from '../common/token.ts';
import type { HttpClient, RequestSpec } from '../http/http.ts';
import { refreshTokenFor, Seeded, UserIds } from '../session/users.ts';
import { appointmentBody, dateAfter, spec, type EndpointData } from './endpoint-targets.ts';

export interface UsageData extends EndpointData {
  refreshTokenCount: number;
}

interface Visit {
  data: UsageData;
  iteration: number;
  user: number;
}

type Caller = 'seeded' | 'guest' | 'fresh';

interface UsageEndpoint {
  name: string;
  calls: number;
  caller?: Caller;
  request(visit: Visit): RequestSpec | null;
}

export const USAGE_ENDPOINTS: readonly UsageEndpoint[] = [
  { name: 'GET /api/catalog', calls: 1318, request: () => spec('GET /api/catalog', '/api/catalog', [200]) },
  {
    name: 'POST /api/auth/web/sessions/refresh guest',
    calls: 170,
    caller: 'guest',
    request: () => spec('POST /api/auth/web/sessions/refresh guest', '/api/auth/web/sessions/refresh', [401]),
  },
  { name: 'GET /api/users/me guest', calls: 167, caller: 'guest', request: () => spec('GET /api/users/me guest', '/api/users/me', [401]) },
  { name: 'GET /api/checklists/me', calls: 130, request: () => spec('GET /api/checklists/me', '/api/checklists/me', [200]) },
  { name: 'GET /api/users/me', calls: 96, request: () => spec('GET /api/users/me', '/api/users/me', [200]) },
  { name: 'GET /api/users/me/wedding-date', calls: 87, request: () => spec('GET /api/users/me/wedding-date', '/api/users/me/wedding-date', [200, 404]) },
  {
    name: 'POST /api/checklists/me/catalog-items',
    calls: 83,
    request: ({ data, iteration, user }) =>
      spec(
        'POST /api/checklists/me/catalog-items',
        '/api/checklists/me/catalog-items',
        [201, 409],
        [data.catalogItemIds[Seeded.unusedCatalogRank(user, Math.floor(iteration / data.seededUsers), data.catalogItemIds.length)]],
      ),
  },
  {
    name: 'POST /api/auth/native/sessions/refresh',
    calls: 69,
    caller: 'guest',
    request: ({ data, iteration }) =>
      iteration >= data.refreshTokenCount
        ? null
        : spec('POST /api/auth/native/sessions/refresh', '/api/auth/native/sessions/refresh', [200], { refreshToken: refreshTokenFor(iteration) }),
  },
  {
    name: 'GET /api/checklists/me/recommended-catalog-items',
    calls: 63,
    request: () => spec('GET /api/checklists/me/recommended-catalog-items', '/api/checklists/me/recommended-catalog-items?limit=4', [200]),
  },
  {
    name: 'PUT /api/checklist-items/{id}/status',
    calls: 19,
    request: ({ iteration, user }) =>
      spec('PUT /api/checklist-items/{id}/status', `/api/checklist-items/${Seeded.checklistItemId(user)}/status`, [200], iteration % 2 === 0 ? 'continue' : 'prev', true),
  },
  {
    name: 'PUT /api/appointments/{id}/complete',
    calls: 15,
    request: ({ iteration, user }) => spec('PUT /api/appointments/{id}/complete', `/api/appointments/${Seeded.appointmentId(user)}/complete`, [200], iteration % 2 === 0),
  },
  { name: 'GET /api/terms', calls: 14, caller: 'guest', request: () => spec('GET /api/terms', '/api/terms', [200]) },
  {
    name: 'POST /api/checklists/me/items',
    calls: 12,
    request: ({ data, iteration }) => spec('POST /api/checklists/me/items', '/api/checklists/me/items', [201], { title: `할 일 ${iteration}`, categoryId: data.categoryIds[0] }),
  },
  { name: 'POST /api/checklists', calls: 12, caller: 'fresh', request: () => spec('POST /api/checklists', '/api/checklists', [201]) },
  {
    name: 'GET /api/checklist-items/{id}/remaining-appointments',
    calls: 10,
    request: ({ user }) => spec('GET /api/checklist-items/{id}/remaining-appointments', `/api/checklist-items/${Seeded.checklistItemId(user)}/remaining-appointments`, [200]),
  },
  {
    name: 'POST /api/checklist-items/{id}/appointments',
    calls: 6,
    request: ({ iteration, user }) =>
      spec('POST /api/checklist-items/{id}/appointments', `/api/checklist-items/${Seeded.checklistItemId(user)}/appointments`, [201], appointmentBody(dateAfter(1 + (iteration % 28)))),
  },
];

const TOTAL_CALLS = USAGE_ENDPOINTS.reduce((sum, endpoint) => sum + endpoint.calls, 0);

export function shareOf(endpoint: UsageEndpoint): number {
  return endpoint.calls / TOTAL_CALLS;
}

export class UsageRunner {
  private readonly tokensByUser = new Map<number, string>();

  constructor(
    private readonly client: HttpClient,
    private readonly tokens: AccessTokenIssuer,
  ) {}

  run(index: number, data: UsageData): void {
    const endpoint = USAGE_ENDPOINTS[index];
    const iteration = exec.scenario.iterationInTest;
    const user = iteration % data.seededUsers;
    const request = endpoint.request({ data, iteration, user });
    if (request !== null) {
      this.client.send(this.tokenFor(endpoint.caller ?? 'seeded', data, iteration, user), request);
    }
  }

  private tokenFor(caller: Caller, data: UsageData, iteration: number, user: number): string | null {
    if (caller === 'guest') {
      return null;
    }
    if (caller === 'fresh') {
      return this.tokens.issue(UserIds.fresh(data.runId, iteration));
    }
    let token = this.tokensByUser.get(user);
    if (token === undefined) {
      token = this.tokens.issue(Seeded.userId(user));
      this.tokensByUser.set(user, token);
    }
    return token;
  }
}

export function usageScenarioName(index: number): string {
  return `u${String(index).padStart(2, '0')}`;
}
