import exec from 'k6/execution';
import { sleep } from 'k6';
import type { RefinedResponse } from 'k6/http';
import type { AccessTokenIssuer } from '../common/token.ts';
import { WORST_CASE } from '../config/targets.ts';
import type { HttpClient, RequestSpec } from '../http/http.ts';
import { refreshTokenFor, Seeded, UserIds } from '../session/users.ts';

export interface EndpointData {
  runId: number;
  seededUsers: number;
  categoryIds: number[];
  // 준비 목록 항목 번호를 오름차순으로 둔 것. 시드의 항목 번호(1부터 연속)와 같은 순서다.
  catalogItemIds: number[];
  termsVersion: string;
}

interface UserState {
  token: string;
  // 제목·상태·카테고리 변경 대상. 준비 목록에서 추가한 항목은 제목·카테고리를 바꿀 수 없어 직접 만든 항목을 쓴다.
  customItemId: number;
  // 삭제 대상. 삭제 요청이 한꺼번에 나가도록 쉬는 동안 미리 만들어 둔다.
  pendingId: number;
  refreshToken: string | undefined;
}

interface Context {
  data: EndpointData;
  // 시드 사용자 번호(0부터)
  user: number;
  round: number;
  state: UserState;
  prepare: Prepare;
}

// 시험 대상 요청 하나. 준비 요청은 kind=fixture로 태그해 판정에서 뺀다.
interface Target {
  name: string;
  // 라운드마다 체크리스트가 없는 새 사용자로 보낸다(체크리스트 생성은 사용자당 한 번만 성공한다).
  freshUser?: boolean;
  // 첫 요청 전과 요청마다 그 직후(다음 라운드 몫)에 부른다. 요청이 한꺼번에 나가도록 준비는 쉬는 동안 끝낸다.
  prepare?(context: Context): void;
  request(context: Context): RequestSpec;
  onResponse?(context: Context, response: RefinedResponse<'text'>): void;
}

function dateAfter(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function appointmentBody(date: string) {
  return { title: '부하 테스트 일정', date, startTime: `${date}T10:00:00`, endTime: `${date}T11:00:00`, place: '부하 테스트 장소', memo: 'k6' };
}

function spec(name: string, path: string, expected: readonly number[], body?: unknown, rawBody = false): RequestSpec {
  return { name, method: name.slice(0, name.indexOf(' ')) as RequestSpec['method'], path, body, expected, rawBody };
}

class Prepare {
  constructor(
    private readonly client: HttpClient,
    private readonly token: string,
  ) {}

  private send(request: RequestSpec) {
    return this.client.send(this.token, { ...request, kind: 'fixture' });
  }

  appointment(itemId: number): number {
    const response = this.send(
      spec('POST /api/checklist-items/{id}/appointments', `/api/checklist-items/${itemId}/appointments`, [201], appointmentBody(dateAfter(1))),
    );
    return (response.json() as unknown as { id: number }).id;
  }

  customItem(categoryId: number): number {
    const response = this.send(spec('POST /api/checklists/me/items', '/api/checklists/me/items', [201], { title: '직접 만든 할 일', categoryId }));
    return (response.json() as unknown as { id: number }).id;
  }
}

function ensureCustomItem({ data, state, prepare }: Context): void {
  if (state.customItemId === 0) {
    state.customItemId = prepare.customItem(data.categoryIds[0]);
  }
}

export const TARGETS: readonly Target[] = [
  { name: 'GET /api/terms', request: () => spec('GET /api/terms', '/api/terms', [200]) },
  {
    name: 'POST /api/users/me/terms-agreement',
    request: ({ data }) => spec('POST /api/users/me/terms-agreement', '/api/users/me/terms-agreement', [200, 409], { termsVersion: data.termsVersion, agreed: true }),
  },
  { name: 'GET /api/users/me', request: () => spec('GET /api/users/me', '/api/users/me', [200]) },
  { name: 'GET /api/users/me/wedding-date', request: () => spec('GET /api/users/me/wedding-date', '/api/users/me/wedding-date', [200, 404]) },
  {
    name: 'PUT /api/users/me/wedding-date',
    request: ({ round }) => spec('PUT /api/users/me/wedding-date', '/api/users/me/wedding-date', [200], { weddingDate: dateAfter(90 + (round % 30)) }),
  },
  {
    name: 'GET /api/users/nickname/availability',
    request: ({ user, round }) => spec('GET /api/users/nickname/availability', `/api/users/nickname/availability?nickname=a${user}r${round}`, [200]),
  },
  {
    // 닉네임은 10자 이하이고 중복될 수 없다. 사용자 번호와 라운드로 사용자마다 다른 값을 만든다.
    name: 'PUT /api/users/me/nickname',
    request: ({ user, round }) => spec('PUT /api/users/me/nickname', '/api/users/me/nickname', [200], { nickname: `n${user}r${round}` }),
  },
  { name: 'GET /api/catalog', request: () => spec('GET /api/catalog', '/api/catalog', [200]) },
  { name: 'POST /api/checklists', freshUser: true, request: () => spec('POST /api/checklists', '/api/checklists', [201]) },
  {
    // 시드가 담아 둔 항목 뒤 번호부터 골라 중복(409)을 피한다.
    name: 'POST /api/checklists/me/catalog-items',
    request: ({ data, user, round }) =>
      spec(
        'POST /api/checklists/me/catalog-items',
        '/api/checklists/me/catalog-items',
        [201, 409],
        [data.catalogItemIds[Seeded.unusedCatalogRank(user, round, data.catalogItemIds.length)]],
      ),
  },
  {
    name: 'POST /api/checklists/me/items',
    request: ({ data, round }) => spec('POST /api/checklists/me/items', '/api/checklists/me/items', [201], { title: `할 일 ${round}`, categoryId: data.categoryIds[0] }),
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
    // 제목은 본문 전체가 값이다(JSON 따옴표 없음).
    name: 'PUT /api/checklist-items/{id}/title',
    prepare: ensureCustomItem,
    request: ({ state, round }) => spec('PUT /api/checklist-items/{id}/title', `/api/checklist-items/${state.customItemId}/title`, [200], `수정한 할 일 ${round}`, true),
  },
  {
    // 상태는 prev·continue·done 중 하나이고 본문 전체가 값이다.
    name: 'PUT /api/checklist-items/{id}/status',
    prepare: ensureCustomItem,
    request: ({ state, round }) => spec('PUT /api/checklist-items/{id}/status', `/api/checklist-items/${state.customItemId}/status`, [200], round % 2 === 0 ? 'continue' : 'prev', true),
  },
  {
    // 카테고리는 JSON 숫자 하나다.
    name: 'PUT /api/checklist-items/{id}/category',
    prepare: ensureCustomItem,
    request: ({ data, state, round }) =>
      spec('PUT /api/checklist-items/{id}/category', `/api/checklist-items/${state.customItemId}/category`, [200], data.categoryIds[round % data.categoryIds.length]),
  },
  {
    name: 'GET /api/checklist-items/{id}/remaining-appointments',
    request: ({ user }) => spec('GET /api/checklist-items/{id}/remaining-appointments', `/api/checklist-items/${Seeded.checklistItemId(user)}/remaining-appointments`, [200]),
  },
  {
    name: 'POST /api/checklist-items/{id}/appointments',
    request: ({ user, round }) =>
      spec('POST /api/checklist-items/{id}/appointments', `/api/checklist-items/${Seeded.checklistItemId(user)}/appointments`, [201], appointmentBody(dateAfter(1 + (round % 28)))),
  },
  {
    name: 'PUT /api/appointments/{id}',
    request: ({ user, round }) => spec('PUT /api/appointments/{id}', `/api/appointments/${Seeded.appointmentId(user)}`, [200], appointmentBody(dateAfter(1 + (round % 28)))),
  },
  {
    name: 'PUT /api/appointments/{id}/complete',
    request: ({ user, round }) => spec('PUT /api/appointments/{id}/complete', `/api/appointments/${Seeded.appointmentId(user)}/complete`, [200], round % 2 === 0),
  },
  {
    name: 'DELETE /api/appointments/{id}',
    prepare: (context) => {
      context.state.pendingId = context.prepare.appointment(Seeded.checklistItemId(context.user));
    },
    request: ({ state }) => spec('DELETE /api/appointments/{id}', `/api/appointments/${state.pendingId}`, [204]),
  },
  {
    name: 'DELETE /api/checklist-items/{id}',
    prepare: (context) => {
      context.state.pendingId = context.prepare.customItem(context.data.categoryIds[0]);
    },
    request: ({ state }) => spec('DELETE /api/checklist-items/{id}', `/api/checklist-items/${state.pendingId}`, [204]),
  },
  {
    // 리프레시 토큰은 한 번만 쓸 수 있다. 받은 토큰을 다음 라운드에 이어 쓴다.
    name: 'POST /api/auth/native/sessions/refresh',
    request: ({ user, state }) =>
      spec('POST /api/auth/native/sessions/refresh', '/api/auth/native/sessions/refresh', [200], { refreshToken: state.refreshToken ?? refreshTokenFor(user) }),
    onResponse: ({ state }, response) => {
      // 연결이 끊긴 요청은 서버가 토큰을 돌렸는지 알 수 없다. 이전 토큰을 그대로 두고 다음 라운드에 다시 보낸다.
      if (response.status === 200) {
        state.refreshToken = (response.json() as unknown as { refreshToken: string }).refreshToken;
      }
    },
  },
  {
    // 로그아웃은 세션을 지우므로 첫 라운드만 실제 세션을 지우고 이후는 이미 지워진 토큰이다. 지워진 토큰도 5xx 없이 끝나야 한다.
    name: 'DELETE /api/auth/native/sessions/current',
    request: ({ data, user }) =>
      spec('DELETE /api/auth/native/sessions/current', '/api/auth/native/sessions/current', [204, 401], {
        refreshToken: refreshTokenFor(data.seededUsers + user),
      }),
  },
];

// 시나리오 이름이자 임계값에 쓰는 scenario 태그 값.
export function scenarioNameOf(index: number): string {
  return `t${String(index).padStart(2, '0')}`;
}

// 모든 사용자가 라운드 시작 시각(시나리오 시작 + 라운드 길이의 배수)에 맞춰 동시에 요청하도록 그때까지 쉰다.
// 응답이 늦어도 최소 휴식은 지킨다. 그러면 다음 시작 시각으로 넘어간다.
function restUntilNextRound(minRestSeconds: number): void {
  const periodMs = WORST_CASE.periodSeconds * 1000;
  const elapsedMs = Date.now() - exec.scenario.startTime;
  const nextMs = Math.ceil((elapsedMs + minRestSeconds * 1000) / periodMs) * periodMs;
  sleep(Math.max(0, nextMs - elapsedMs) / 1000);
}

export class EndpointRunner {
  // k6는 VU마다 자바스크립트 런타임이 따로라 이 상태는 VU 하나의 것이다. 시나리오가 바뀌면 다시 만든다.
  private state: { index: number; user: UserState } | undefined;

  constructor(
    private readonly client: HttpClient,
    private readonly tokens: AccessTokenIssuer,
  ) {}

  run(index: number, data: EndpointData): void {
    const target = TARGETS[index];
    const user = (exec.vu.idInInstance - 1) % data.seededUsers;
    const round = exec.vu.iterationInScenario;
    const state = this.stateFor(index, user);
    const context: Context = { data, user, round, state, prepare: new Prepare(this.client, state.token) };

    if (round === 0 && target.prepare !== undefined) {
      target.prepare(context);
      restUntilNextRound(0);
    }

    const token = target.freshUser ? this.tokens.issue(UserIds.fresh(data.runId, user + data.seededUsers * round)) : state.token;
    const response = this.client.send(token, target.request(context));
    target.onResponse?.(context, response);

    target.prepare?.(context);
    restUntilNextRound(WORST_CASE.minRestSeconds);
  }

  private stateFor(index: number, user: number): UserState {
    if (this.state === undefined || this.state.index !== index) {
      this.state = {
        index,
        user: { token: this.tokens.issue(Seeded.userId(user)), customItemId: 0, pendingId: 0, refreshToken: undefined },
      };
    }
    return this.state.user;
  }
}
