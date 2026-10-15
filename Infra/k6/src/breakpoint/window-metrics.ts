import type { RefinedResponse } from 'k6/http';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import type { RequestSpec, ResponseObserver } from '../http/http.ts';
import type { WindowPlan } from './windows.ts';

export class WindowMetrics implements ResponseObserver {
  private readonly latency = new Trend('window_latency', true);
  private readonly serverError = new Rate('window_server_error');
  private readonly requests = new Counter('window_requests');

  constructor(private readonly plan: WindowPlan) {}

  observe(spec: RequestSpec, response: RefinedResponse<'text'>): void {
    if (__VU === 0) {
      return;
    }

    const tags = { window: String(this.plan.windowAt(Date.now() - exec.scenario.startTime)) };
    if (spec.method === 'GET') {
      this.latency.add(response.timings.duration, tags);
    }
    this.serverError.add(response.status >= 500, tags);
    this.requests.add(1, tags);
  }
}
