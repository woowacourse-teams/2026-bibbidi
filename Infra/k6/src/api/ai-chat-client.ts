import { check } from 'k6';
import sse from 'k6/x/sse';
import type { TagProvider } from '../config/shape.ts';
import { serverErrors } from '../http/http.ts';

export const AI_CHAT_REQUEST_NAME = 'POST /api/ai/chat';

// SSE 결과를 다섯 가지로 센다.
//   completed     완료 이벤트(done)를 받음
//   failure_event 구분된 실패 안내 이벤트(failure)를 받음
//   rejected      4xx로 거절됨
//   disconnected  200인데 완료도 실패 안내도 없이 끊김. 무응답이므로 0건이어야 한다
//   http_error    5xx 또는 상태 0(연결 실패)
export type AiOutcome = 'completed' | 'failure_event' | 'rejected' | 'disconnected' | 'http_error';

export interface ChatCallResult {
  startedAt: number;
  durationMs: number;
  status: number;
  outcome: AiOutcome;
  completed: boolean;
  ttftMs: number | undefined;
  // 요청을 보낸 뒤 실패 안내 이벤트가 도착하기까지 걸린 시간. 실패 안내를 받았을 때만 있다.
  failureMs: number | undefined;
  conversationId: string | undefined;
}

export interface ChatObserver {
  observe(result: ChatCallResult): void;
}

export class AiChatClient {
  constructor(
    private readonly baseUrl: string,
    private readonly observers: readonly ChatObserver[] = [],
    private readonly extraTags: TagProvider = () => ({}),
  ) {}

  call(token: string, message: string, conversationId?: string): ChatCallResult {
    const startedAt = Date.now();
    let ttftMs: number | undefined;
    let failureMs: number | undefined;
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
        tags: { ...this.extraTags(), kind: 'ai', name: AI_CHAT_REQUEST_NAME },
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
            failureMs ??= Date.now() - startedAt;
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

    const outcome = this.classify(status, completed, failed, failureMs !== undefined);
    const result: ChatCallResult = {
      startedAt,
      durationMs: Date.now() - startedAt,
      status,
      outcome,
      completed: outcome === 'completed' && !failed,
      ttftMs,
      failureMs,
      conversationId: resolvedConversationId,
    };
    for (const observer of this.observers) {
      observer.observe(result);
    }
    return result;
  }

  private classify(status: number, completed: boolean, failed: boolean, sawFailureEvent: boolean): AiOutcome {
    if (status === 0 || status >= 500) {
      return 'http_error';
    }
    if (status >= 400) {
      return 'rejected';
    }
    if (sawFailureEvent) {
      return 'failure_event';
    }
    return completed && !failed ? 'completed' : 'disconnected';
  }

  private conversationIdOf(data: string): string | undefined {
    try {
      return (JSON.parse(data) as { conversationId?: string }).conversationId;
    } catch {
      return undefined;
    }
  }
}
