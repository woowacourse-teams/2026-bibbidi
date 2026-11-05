import type { Options, Threshold } from 'k6/options';

export interface WindowPlanOptions {
  windowSeconds: number;
  stepRate: number;
  windows: number;
  unitSeconds?: number;
}

export interface WindowRule {
  metric: string;
  expression: string;
  evalDelaySeconds: number;
}

export interface TrackedMetric {
  metric: string;
  expression: string;
}

export interface ThresholdSpec {
  rules: readonly WindowRule[];
  tracked: readonly TrackedMetric[];
  global?: Record<string, Threshold[]>;
}

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

  get unitSeconds(): number {
    return this.options.unitSeconds ?? 1;
  }

  endRate(window: number): number {
    return this.options.stepRate * window;
  }

  perSecond(window: number): number {
    return this.endRate(window) / this.unitSeconds;
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

  thresholds(spec: ThresholdSpec): NonNullable<Options['thresholds']> {
    const thresholds: Record<string, Threshold[]> = { ...spec.global };

    for (let window = 1; window <= this.options.windows; window += 1) {
      const windowStart = (window - 1) * this.options.windowSeconds;
      for (const rule of spec.rules) {
        thresholds[`${rule.metric}{window:${window}}`] = [
          { threshold: rule.expression, abortOnFail: true, delayAbortEval: `${windowStart + rule.evalDelaySeconds}s` },
        ];
      }
      for (const tracked of spec.tracked) {
        thresholds[`${tracked.metric}{window:${window}}`] = [tracked.expression];
      }
    }

    return thresholds;
  }
}
