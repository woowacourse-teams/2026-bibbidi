import type { HttpClient } from '../http/http.ts';
import { isChatCompleted, parseSseEvents } from './sse.ts';

export const AI_CHAT_REQUEST_NAME = 'POST /api/ai/chat';

export interface ChatReply {
  completed: boolean;
  conversationId: string | undefined;
}

export class AiChatApi {
  constructor(
    private readonly client: HttpClient,
    private readonly token: string,
  ) {}

  ask(message: string, conversationId?: string): ChatReply {
    const response = this.client.send(this.token, {
      name: AI_CHAT_REQUEST_NAME,
      method: 'POST',
      path: '/api/ai/chat',
      body: conversationId === undefined ? { message } : { conversationId, message },
      expected: [200],
      timeout: '75s',
    });

    const body = typeof response.body === 'string' ? response.body : null;
    return {
      completed: isChatCompleted(response.status, body),
      conversationId: this.conversationIdOf(body),
    };
  }

  private conversationIdOf(body: string | null): string | undefined {
    const event = parseSseEvents(body).find((candidate) => candidate.name === 'conversation');
    if (event === undefined) {
      return undefined;
    }
    try {
      return (JSON.parse(event.data) as { conversationId?: string }).conversationId;
    } catch {
      return undefined;
    }
  }
}
