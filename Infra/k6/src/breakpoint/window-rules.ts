import type { ThresholdSpec } from './windows.ts';

export function generalRules(evalDelaySeconds: number): ThresholdSpec {
  return {
    rules: [
      { metric: 'window_latency', expression: 'p(99)<1000', evalDelaySeconds },
      { metric: 'window_server_error', expression: 'rate<0.01', evalDelaySeconds },
    ],
    tracked: [{ metric: 'window_requests', expression: 'count>=0' }],
    global: { dropped_iterations: [{ threshold: 'count==0', abortOnFail: true }] },
  };
}

export function aiRules(evalDelaySeconds: number, abortOnDropped: boolean): ThresholdSpec {
  return {
    rules: [
      { metric: 'window_ai_completed', expression: 'rate>=0.9', evalDelaySeconds },
      { metric: 'window_ai_server_error', expression: 'rate<0.01', evalDelaySeconds },
    ],
    tracked: [
      { metric: 'window_ai_requests', expression: 'count>=0' },
      { metric: 'window_ai_duration', expression: 'max>=0' },
    ],
    global: abortOnDropped ? { dropped_iterations: [{ threshold: 'count==0', abortOnFail: true }] } : {},
  };
}
