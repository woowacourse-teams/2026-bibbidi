import { Counter, Trend } from 'k6/metrics';
import type { ChatCallResult, ChatObserver } from '../api/ai-chat-client.ts';
import type { TagProvider } from '../config/shape.ts';

// AI 턴의 결과를 센다. 구간 번호 대신 outcome 태그(와 phase)로 나눠 기본 지표처럼 다룬다.
export class AiMetrics implements ChatObserver {
  private readonly turns = new Counter('ai_turns');
  private readonly ttft = new Trend('ai_ttft_ms', true);
  private readonly duration = new Trend('ai_turn_ms', true);
  private readonly failure = new Trend('ai_failure_ms', true);

  constructor(private readonly extraTags: TagProvider = () => ({})) {}

  observe(result: ChatCallResult): void {
    if (this.inSetup()) {
      return;
    }

    const tags = { ...this.extraTags(), outcome: result.outcome };
    this.turns.add(1, tags);
    this.duration.add(result.durationMs, tags);
    if (result.ttftMs !== undefined) {
      this.ttft.add(result.ttftMs, tags);
    }
    if (result.failureMs !== undefined) {
      this.failure.add(result.failureMs, tags);
    }
  }

  // setup()과 teardown()에서 호출된 요청은 센 결과에 넣지 않는다.
  private inSetup(): boolean {
    return __VU === 0;
  }
}
