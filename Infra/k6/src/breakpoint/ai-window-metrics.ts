import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import type { ChatCallResult, ChatObserver } from '../api/ai-chat-client.ts';
import type { WindowPlan } from './windows.ts';

export class AiWindowMetrics implements ChatObserver {
  private readonly completed = new Rate('window_ai_completed');
  private readonly serverError = new Rate('window_ai_server_error');
  private readonly requests = new Counter('window_ai_requests');
  private readonly duration = new Trend('window_ai_duration', true);
  private readonly ttft = new Trend('window_ai_ttft', true);

  constructor(private readonly plan: WindowPlan) {}

  observe(result: ChatCallResult): void {
    if (__VU === 0) {
      return;
    }

    const tags = { window: String(this.plan.windowAt(result.startedAt - exec.scenario.startTime)) };

    this.completed.add(result.completed, tags);
    this.serverError.add(result.status >= 500, tags);
    this.requests.add(1, tags);
    this.duration.add(result.durationMs, tags);
    if (result.ttftMs !== undefined) {
      this.ttft.add(result.ttftMs, tags);
    }
  }
}
