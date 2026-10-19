import type { HttpClient, RequestSpec } from '../http/http.ts';
import type { AccessTokenIssuer } from '../common/token.ts';
import { AiChatApi } from './ai-chat-api.ts';
import type { AiChatClient } from './ai-chat-client.ts';

interface CatalogResponse {
  categories: { steps: { items: CatalogItem[] }[] }[];
}

export interface CatalogItem {
  id: number;
  title: string;
}

export interface Checklist {
  id: number;
  items: { id: number; appointments: { id: number }[] }[];
}

interface AddCatalogItemsResponse {
  items: { id: number }[];
}

interface AppointmentResponse {
  id: number;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

const HOME_READS: readonly RequestSpec[] = [
  { name: 'GET /api/checklists/me/progress', method: 'GET', path: '/api/checklists/me/progress', expected: [200] },
  { name: 'GET /api/appointments/me/nearby', method: 'GET', path: '/api/appointments/me/nearby?limit=6', expected: [200] },
  {
    name: 'GET /api/checklists/me/unscheduled-items',
    method: 'GET',
    path: '/api/checklists/me/unscheduled-items?limit=4',
    expected: [200],
  },
  {
    name: 'GET /api/checklists/me/recommended-catalog-items',
    method: 'GET',
    path: '/api/checklists/me/recommended-catalog-items?limit=4',
    expected: [200],
  },
];

export class BibbidiApi {
  constructor(
    private readonly client: HttpClient,
    private readonly token: string,
  ) {}

  catalogItemIds(): number[] {
    return this.catalogItems().map((item) => item.id);
  }

  catalogItems(): CatalogItem[] {
    const response = this.client.send(this.token, {
      name: 'GET /api/catalog',
      method: 'GET',
      path: '/api/catalog',
      expected: [200],
    });
    return (response.json() as unknown as CatalogResponse).categories.flatMap((category) =>
      category.steps.flatMap((step) => step.items),
    );
  }

  createChecklist(): void {
    this.client.send(this.token, {
      name: 'POST /api/checklists',
      method: 'POST',
      path: '/api/checklists',
      expected: [201],
    });
  }

  addCatalogItems(catalogItemIds: number[]): number[] {
    const response = this.client.send(this.token, {
      name: 'POST /api/checklists/me/catalog-items',
      method: 'POST',
      path: '/api/checklists/me/catalog-items',
      body: catalogItemIds,
      expected: [201],
    });
    return (response.json() as unknown as AddCatalogItemsResponse).items.map((item) => item.id);
  }

  createAppointment(checklistItemId: number, daysAfter: number): number {
    const date = this.dateAfter(daysAfter);
    const response = this.client.send(this.token, {
      name: 'POST /api/checklist-items/{id}/appointments',
      method: 'POST',
      path: `/api/checklist-items/${checklistItemId}/appointments`,
      body: {
        title: '부하 테스트 일정',
        date,
        startTime: `${date}T10:00:00`,
        endTime: `${date}T11:00:00`,
        place: '부하 테스트 장소',
        memo: 'k6',
      },
      expected: [201],
    });
    return (response.json() as unknown as AppointmentResponse).id;
  }

  findChecklist(): Checklist | null {
    const response = this.client.send(this.token, {
      name: 'GET /api/checklists/me',
      method: 'GET',
      path: '/api/checklists/me',
      expected: [200, 404],
    });
    return response.status === 200 ? (response.json() as unknown as Checklist) : null;
  }

  changeAppointmentCompletion(appointmentId: number, isDone: boolean): void {
    this.client.send(this.token, {
      name: 'PUT /api/appointments/{id}/complete',
      method: 'PUT',
      path: `/api/appointments/${appointmentId}/complete`,
      body: isDone,
      expected: [200],
    });
  }

  // 홈 화면은 API 4개를 동시에 부른다.
  visitHome(): void {
    this.client.sendBatch(this.token, HOME_READS);
  }

  private dateAfter(days: number): string {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
}

// 인증 없이 부르는 세션 갱신. 토큰을 회전하므로 같은 토큰을 두 번 쓰면 두 번째는 재사용으로 거절된다.
export class AuthApi {
  constructor(private readonly client: HttpClient) {}

  refresh(refreshToken: string): IssuedTokens | null {
    const response = this.client.send(null, this.refreshSpec(refreshToken, [200]));
    return response.status === 200 ? (response.json() as unknown as IssuedTokens) : null;
  }

  // 여러 탭이 같은 토큰으로 동시에 갱신하는 상황. 하나는 성공하고 나머지는 재사용으로 401을 받는다.
  // 재사용으로 거절되는 401은 기대한 응답이지만 http.batch가 실패로 세므로, kind=refresh_burst로 일반 API 판정에서 뺀다.
  refreshFromTwoTabs(refreshToken: string): IssuedTokens | null {
    const specs = [
      { ...this.refreshSpec(refreshToken, [200, 401]), kind: 'refresh_burst' },
      { ...this.refreshSpec(refreshToken, [200, 401]), kind: 'refresh_burst' },
    ];
    const responses = this.client.sendBatch(null, specs);
    const winner = responses.find((response) => response.status === 200);
    return winner === undefined ? null : (winner.json() as unknown as IssuedTokens);
  }

  private refreshSpec(refreshToken: string, expected: readonly number[]): RequestSpec {
    return {
      name: 'POST /api/auth/native/sessions/refresh',
      method: 'POST',
      path: '/api/auth/native/sessions/refresh',
      body: { refreshToken },
      expected,
    };
  }
}

export class ApiFactory {
  constructor(
    private readonly client: HttpClient,
    private readonly tokens: AccessTokenIssuer,
    private readonly chatClient?: AiChatClient,
  ) {}

  forUser(userId: number): BibbidiApi {
    return new BibbidiApi(this.client, this.tokens.issue(userId));
  }

  forAccessToken(accessToken: string): BibbidiApi {
    return new BibbidiApi(this.client, accessToken);
  }

  auth(): AuthApi {
    return new AuthApi(this.client);
  }

  chatFor(userId: number): AiChatApi {
    if (this.chatClient === undefined) {
      throw new Error('AI 채팅 클라이언트가 설정되지 않았습니다.');
    }
    return new AiChatApi(this.chatClient, this.tokens.issue(userId));
  }
}
