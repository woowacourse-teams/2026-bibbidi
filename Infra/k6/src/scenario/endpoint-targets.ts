import exec from 'k6/execution';
import type { RefinedResponse } from 'k6/http';
import type { AccessTokenIssuer } from '../common/token.ts';
import type { HttpClient, RequestSpec } from '../http/http.ts';
import { refreshTokenFor, UserIds } from '../session/users.ts';

export interface EndpointData {
  runId: number;
  categoryIds: number[];
  itemIds: number[];
  termsVersion: string;
}

interface UserState {
  token: string;
  checklistItemId: number;
  appointmentId: number;
  refreshToken: string | undefined;
}

interface Context {
  data: EndpointData;
  user: number;
  iteration: number;
  state: UserState;
  prepare: Prepare;
}

// 시험 대상 요청 하나. 준비 요청(체크리스트·일정 만들기)은 kind=fixture로 태그해 판정에서 뺀다.
interface Target {
  name: string;
  // 체크리스트가 없어도 되는 요청
  bare?: boolean;
  request(context: Context): RequestSpec;
  onResponse?(context: Context, response: RefinedResponse<'text'>): void;
}

const OK = [200, 201, 204];
// 입력에 따라 거절될 수 있는 요청은 4xx도 기대한 응답으로 본다. 서버 오류(5xx)만 실패다.
const OK_OR_REJECTED = [200, 201, 204, 400, 409];

function dateAfter(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function appointmentBody(date: string) {
  return { title: '부하 테스트 일정', date, startTime: `${date}T10:00:00`, endTime: `${date}T11:00:00`, place: '부하 테스트 장소', memo: 'k6' };
}

function spec(name: string, path: string, expected: readonly number[], body?: unknown): RequestSpec {
  return { name, method: name.slice(0, name.indexOf(' ')) as RequestSpec['method'], path, body, expected };
}

class Prepare {
  constructor(
    private readonly client: HttpClient,
    private readonly token: string,
  ) {}

  private send(request: RequestSpec) {
    return this.client.send(this.token, { ...request, kind: 'fixture' });
  }

  checklist(itemIds: number[]): number {
    this.send(spec('POST /api/checklists', '/api/checklists', [201, 409]));
    const added = this.send(spec('POST /api/checklists/me/catalog-items', '/api/checklists/me/catalog-items', OK_OR_REJECTED, itemIds.slice(0, 3)));
    return (added.json() as unknown as { items: { id: number }[] }).items?.[0]?.id ?? 0;
  }

  appointment(itemId: number): number {
    const response = this.send(spec('POST /api/checklist-items/{id}/appointments', `/api/checklist-items/${itemId}/appointments`, [201], appointmentBody(dateAfter(1))));
    return (response.json() as unknown as { id: number }).id;
  }

  customItem(categoryId: number): number {
    const response = this.send(spec('POST /api/checklists/me/items', '/api/checklists/me/items', [201], { title: '삭제할 할 일', categoryId }));
    return (response.json() as unknown as { id: number }).id;
  }
}

// 시드가 만든 리프레시 세션은 한 번만 쓸 수 있어, 갱신과 로그아웃이 서로 다른 번호 대역을 쓴다.
const LOGOUT_TOKEN_OFFSET = 1000;

export const TARGETS: readonly Target[] = [
  { name: 'GET /api/terms', bare: true, request: () => spec('GET /api/terms', '/api/terms', [200]) },
  {
    name: 'POST /api/users/me/terms-agreement',
    bare: true,
    request: ({ data }) => spec('POST /api/users/me/terms-agreement', '/api/users/me/terms-agreement', OK_OR_REJECTED, { termsVersion: data.termsVersion, agreed: true }),
  },
  { name: 'GET /api/users/me', bare: true, request: () => spec('GET /api/users/me', '/api/users/me', [200, 404]) },
  { name: 'GET /api/users/me/wedding-date', bare: true, request: () => spec('GET /api/users/me/wedding-date', '/api/users/me/wedding-date', [200, 404]) },
  {
    name: 'PUT /api/users/me/wedding-date',
    bare: true,
    request: ({ iteration }) => spec('PUT /api/users/me/wedding-date', '/api/users/me/wedding-date', OK_OR_REJECTED, { weddingDate: dateAfter(90 + (iteration % 30)) }),
  },
  {
    name: 'GET /api/users/nickname/availability',
    bare: true,
    request: ({ user, iteration }) => spec('GET /api/users/nickname/availability', `/api/users/nickname/availability?nickname=u${user}x${iteration % 100}`, [200, 400]),
  },
  {
    name: 'PUT /api/users/me/nickname',
    bare: true,
    request: ({ user, iteration }) => spec('PUT /api/users/me/nickname', '/api/users/me/nickname', OK_OR_REJECTED, { nickname: `u${user}x${iteration % 100}`.slice(0, 10) }),
  },
  { name: 'GET /api/catalog', bare: true, request: () => spec('GET /api/catalog', '/api/catalog', [200]) },
  { name: 'POST /api/checklists', bare: true, request: () => spec('POST /api/checklists', '/api/checklists', [201, 409]) },
  {
    name: 'POST /api/checklists/me/catalog-items',
    request: ({ data, iteration }) => spec('POST /api/checklists/me/catalog-items', '/api/checklists/me/catalog-items', OK_OR_REJECTED, [data.itemIds[iteration % data.itemIds.length]]),
  },
  {
    name: 'POST /api/checklists/me/items',
    request: ({ data, iteration }) => spec('POST /api/checklists/me/items', '/api/checklists/me/items', [201], { title: `할 일 ${iteration}`, categoryId: data.categoryIds[0] }),
  },
  { name: 'GET /api/checklists/me', request: () => spec('GET /api/checklists/me', '/api/checklists/me', [200]) },
  { name: 'GET /api/checklists/me/progress', request: () => spec('GET /api/checklists/me/progress', '/api/checklists/me/progress', [200]) },
  { name: 'GET /api/appointments/me/nearby', request: () => spec('GET /api/appointments/me/nearby', '/api/appointments/me/nearby?limit=6', [200]) },
  { name: 'GET /api/checklists/me/unscheduled-items', request: () => spec('GET /api/checklists/me/unscheduled-items', '/api/checklists/me/unscheduled-items?limit=4', [200]) },
  {
    name: 'GET /api/checklists/me/recommended-catalog-items',
    request: () => spec('GET /api/checklists/me/recommended-catalog-items', '/api/checklists/me/recommended-catalog-items?limit=4', [200]),
  },
  {
    name: 'PUT /api/checklist-items/{id}/title',
    request: ({ state, iteration }) => spec('PUT /api/checklist-items/{id}/title', `/api/checklist-items/${state.checklistItemId}/title`, [200], `수정한 할 일 ${iteration}`),
  },
  {
    name: 'PUT /api/checklist-items/{id}/status',
    request: ({ state, iteration }) => spec('PUT /api/checklist-items/{id}/status', `/api/checklist-items/${state.checklistItemId}/status`, [200], iteration % 2 === 0 ? 'continue' : 'prev'),
  },
  {
    name: 'PUT /api/checklist-items/{id}/category',
    request: ({ data, state, iteration }) =>
      spec('PUT /api/checklist-items/{id}/category', `/api/checklist-items/${state.checklistItemId}/category`, [200], data.categoryIds[iteration % data.categoryIds.length]),
  },
  {
    name: 'GET /api/checklist-items/{id}/remaining-appointments',
    request: ({ state }) => spec('GET /api/checklist-items/{id}/remaining-appointments', `/api/checklist-items/${state.checklistItemId}/remaining-appointments`, [200]),
  },
  {
    name: 'POST /api/checklist-items/{id}/appointments',
    request: ({ state, iteration }) =>
      spec('POST /api/checklist-items/{id}/appointments', `/api/checklist-items/${state.checklistItemId}/appointments`, [201], appointmentBody(dateAfter(1 + (iteration % 28)))),
  },
  {
    name: 'PUT /api/appointments/{id}',
    request: ({ state, iteration }) => spec('PUT /api/appointments/{id}', `/api/appointments/${state.appointmentId}`, [200], appointmentBody(dateAfter(1 + (iteration % 28)))),
  },
  {
    name: 'PUT /api/appointments/{id}/complete',
    request: ({ state, iteration }) => spec('PUT /api/appointments/{id}/complete', `/api/appointments/${state.appointmentId}/complete`, [200], iteration % 2 === 0),
  },
  {
    // 반복마다 일정을 새로 만들어(준비 요청) 지우는 요청만 잰다.
    name: 'DELETE /api/appointments/{id}',
    request: ({ state, prepare }) => spec('DELETE /api/appointments/{id}', `/api/appointments/${prepare.appointment(state.checklistItemId)}`, OK),
  },
  {
    name: 'DELETE /api/checklist-items/{id}',
    request: ({ data, prepare }) => spec('DELETE /api/checklist-items/{id}', `/api/checklist-items/${prepare.customItem(data.categoryIds[0])}`, OK),
  },
  {
    // 리프레시 토큰은 한 번만 쓸 수 있다. 받은 토큰을 다음 반복에 이어 쓴다.
    name: 'POST /api/auth/native/sessions/refresh',
    bare: true,
    request: ({ user, state }) =>
      spec('POST /api/auth/native/sessions/refresh', '/api/auth/native/sessions/refresh', [200, 401], { refreshToken: state.refreshToken ?? refreshTokenFor(user - 1) }),
    onResponse: ({ state }, response) => {
      state.refreshToken = response.status === 200 ? (response.json() as unknown as { refreshToken: string }).refreshToken : undefined;
    },
  },
  {
    // 로그아웃은 세션을 지우므로 첫 반복만 실제 세션을 지우고 이후는 이미 지워진 토큰이다. 지워진 토큰도 5xx 없이 끝나야 한다.
    name: 'DELETE /api/auth/native/sessions/current',
    bare: true,
    request: ({ user }) =>
      spec('DELETE /api/auth/native/sessions/current', '/api/auth/native/sessions/current', [...OK, 400, 401, 404], {
        refreshToken: refreshTokenFor(LOGOUT_TOKEN_OFFSET + user - 1),
      }),
  },
];

// 엔드포인트마다 사용자 대역이 달라, 앞 시험이 만든 데이터에 뒤 시험이 영향을 받지 않는다.
const USERS_PER_TARGET = 2_000;

// 시나리오 이름이자 임계값에 쓰는 scenario 태그 값.
export function scenarioNameOf(index: number): string {
  return `t${String(index).padStart(2, '0')}`;
}

export class EndpointRunner {
  // k6는 VU마다 자바스크립트 런타임이 따로라 이 상태는 VU 하나의 것이다.
  private state: UserState | undefined;

  constructor(
    private readonly client: HttpClient,
    private readonly tokens: AccessTokenIssuer,
  ) {}

  run(index: number, data: EndpointData): void {
    const target = TARGETS[index];
    const user = exec.vu.idInInstance;
    const state = this.stateFor(UserIds.fresh(data.runId, index * USERS_PER_TARGET + user));
    const prepare = new Prepare(this.client, state.token);

    if (!target.bare && state.checklistItemId === 0) {
      state.checklistItemId = prepare.checklist(data.itemIds);
      state.appointmentId = prepare.appointment(state.checklistItemId);
    }

    const context: Context = { data, user, iteration: exec.vu.iterationInScenario, state, prepare };
    const response = this.client.send(state.token, target.request(context));
    target.onResponse?.(context, response);
  }

  // 시나리오가 바뀌면 같은 VU가 다른 사용자로 다시 시작한다.
  private stateFor(userId: number): UserState {
    if (this.state === undefined || this.userId !== userId) {
      this.userId = userId;
      this.state = { token: this.tokens.issue(userId), checklistItemId: 0, appointmentId: 0, refreshToken: undefined };
    }
    return this.state;
  }

  private userId = 0;
}
