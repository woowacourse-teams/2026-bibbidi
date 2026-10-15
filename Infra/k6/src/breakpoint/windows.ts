import type { Options, Threshold } from 'k6/options';

export interface WindowPlanOptions {
  windowSeconds: number;
  stepRate: number;
  windows: number;
  evalDelaySeconds: number;
}

export const WINDOW_LATENCY_LIMIT_MS = 1000;
export const WINDOW_SERVER_ERROR_LIMIT = 0.01;

export class WindowPlan {
  constructor(private readonly options: WindowPlanOptions) {}

  get windows(): number {
    return this.options.windows;
  }

  get windowSeconds(): number {
    return this.options.windowSeconds;
  }

  get stepRate(): number {
    return this.options.stepRate;
  }

  endRate(window: number): number {
    return this.options.stepRate * window;
  }

  windowAt(elapsedMs: number): number {
    const index = Math.floor(elapsedMs / (this.options.windowSeconds * 1000)) + 1;
    return Math.min(Math.max(index, 1), this.options.windows);
  }

  stages(): { duration: string; target: number }[] {
    return Array.from({ length: this.options.windows }, (_, index) => ({
      duration: `${this.options.windowSeconds}s`,
      target: this.endRate(index + 1),
    }));
  }

  thresholds(): NonNullable<Options['thresholds']> {
    const thresholds: Record<string, Threshold[]> = {
      dropped_iterations: [{ threshold: 'count==0', abortOnFail: true }],
    };

    for (let window = 1; window <= this.options.windows; window += 1) {
      const delay = `${(window - 1) * this.options.windowSeconds + this.options.evalDelaySeconds}s`;
      thresholds[`window_latency{window:${window}}`] = [
        { threshold: `p(99)<${WINDOW_LATENCY_LIMIT_MS}`, abortOnFail: true, delayAbortEval: delay },
      ];
      thresholds[`window_requests{window:${window}}`] = ['count>=0'];
      thresholds[`window_server_error{window:${window}}`] = [
        { threshold: `rate<${WINDOW_SERVER_ERROR_LIMIT}`, abortOnFail: true, delayAbortEval: delay },
      ];
    }

    return thresholds;
  }
}
