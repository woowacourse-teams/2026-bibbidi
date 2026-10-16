import type { RefinedResponse } from 'k6/http';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import { AI_CHAT_REQUEST_NAME } from '../api/ai-chat-api.ts';
import { isChatCompleted } from '../api/sse.ts';
import type { RequestSpec, ResponseObserver } from '../http/http.ts';
import type { WindowPlan } from './windows.ts';

export class AiWindowMetrics implements ResponseObserver {
  private readonly completed = new Rate('window_ai_completed');
  private readonly serverError = new Rate('window_ai_server_error');
  private readonly requests = new Counter('window_ai_requests');
  private readonly duration = new Trend('window_ai_duration', true);

  constructor(private readonly plan: WindowPlan) {}

  observe(spec: RequestSpec, response: RefinedResponse<'text'>): void {
    if (__VU === 0 || spec.name !== AI_CHAT_REQUEST_NAME) {
      return;
    }

    const startedAt = Date.now() - response.timings.duration;
    const tags = { window: String(this.plan.windowAt(startedAt - exec.scenario.startTime)) };
    const body = typeof response.body === 'string' ? response.body : null;

    this.completed.add(isChatCompleted(response.status, body), tags);
    this.serverError.add(response.status >= 500, tags);
    this.requests.add(1, tags);
    this.duration.add(response.timings.duration, tags);
  }
}
