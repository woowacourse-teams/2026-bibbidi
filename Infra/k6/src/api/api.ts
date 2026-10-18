import type { HttpClient } from '../http/http.ts';
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

  visitHome(): void {
    const reads: [string, string][] = [
      ['GET /api/checklists/me/progress', '/api/checklists/me/progress'],
      ['GET /api/appointments/me/nearby', '/api/appointments/me/nearby?limit=6'],
      ['GET /api/checklists/me/unscheduled-items', '/api/checklists/me/unscheduled-items?limit=4'],
      ['GET /api/checklists/me/recommended-catalog-items', '/api/checklists/me/recommended-catalog-items?limit=4'],
    ];
    for (const [name, path] of reads) {
      this.client.send(this.token, { name, method: 'GET', path, expected: [200] });
    }
  }

  private dateAfter(days: number): string {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

  chatFor(userId: number): AiChatApi {
    if (this.chatClient === undefined) {
      throw new Error('AI 채팅 클라이언트가 설정되지 않았습니다.');
    }
    return new AiChatApi(this.chatClient, this.tokens.issue(userId));
  }
}
