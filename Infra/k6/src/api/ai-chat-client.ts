import { check } from 'k6';
import sse from 'k6/x/sse';
import { serverErrors } from '../http/http.ts';

export const AI_CHAT_REQUEST_NAME = 'POST /api/ai/chat';

export interface ChatCallResult {
  startedAt: number;
  durationMs: number;
  status: number;
  completed: boolean;
  ttftMs: number | undefined;
  conversationId: string | undefined;
}

export interface ChatObserver {
  observe(result: ChatCallResult): void;
}

export class AiChatClient {
  constructor(
    private readonly baseUrl: string,
    private readonly observers: readonly ChatObserver[] = [],
  ) {}

  call(token: string, message: string, conversationId?: string): ChatCallResult {
    const startedAt = Date.now();
    let ttftMs: number | undefined;
    let completed = false;
    let failed = false;
    let resolvedConversationId = conversationId;

    const response = sse.open(
      `${this.baseUrl}/api/ai/chat`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(conversationId === undefined ? { message } : { conversationId, message }),
        tags: { name: AI_CHAT_REQUEST_NAME },
      },
      (client) => {
        client.on('event', (event) => {
          if (event.name === 'conversation') {
            resolvedConversationId = this.conversationIdOf(event.data) ?? resolvedConversationId;
          } else if (event.name === 'delta') {
            ttftMs ??= Date.now() - startedAt;
          } else if (event.name === 'done') {
            completed = true;
          } else if (event.name === 'failure') {
            failed = true;
          }
        });
        client.on('error', () => {
          failed = true;
        });
      },
    );

    const status = response?.status ?? 0;
    if (status >= 500) {
      serverErrors.add(1);
    }
    check(response, { [`${AI_CHAT_REQUEST_NAME} -> 200`]: (r) => r !== undefined && r.status === 200 });

    const result: ChatCallResult = {
      startedAt,
      durationMs: Date.now() - startedAt,
      status,
      completed: status === 200 && completed && !failed,
      ttftMs,
      conversationId: resolvedConversationId,
    };
    for (const observer of this.observers) {
      observer.observe(result);
    }
    return result;
  }

  private conversationIdOf(data: string): string | undefined {
    try {
      return (JSON.parse(data) as { conversationId?: string }).conversationId;
    } catch {
      return undefined;
    }
  }
}
