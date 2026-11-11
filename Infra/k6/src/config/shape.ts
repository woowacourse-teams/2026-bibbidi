import exec from 'k6/execution';
import type { Scenario } from 'k6/options';
import { numberFromEnv } from '../common/environment.ts';
import { PEAK, SHAPE, VUS } from './targets.ts';

export type TagProvider = () => Record<string, string>;
export type Stage = { duration: string; target: number };

// 시나리오가 시작한 뒤 흐른 초. setup()처럼 시나리오 밖이면 undefined다.
function elapsedSeconds(): number | undefined {
  try {
    return (Date.now() - exec.scenario.startTime) / 1000;
  } catch {
    return undefined;
  }
}

// 도착률 시나리오는 분당 시작 횟수로 정의한다. 몫이 작아도 정수 목표를 쓸 수 있다.
function perMinute(sessionsPerSecond: number, share: number): number {
  return Math.max(1, Math.round(sessionsPerSecond * 60 * share));
}

function arrival(stages: Stage[], startRate: number, flow: string): Scenario {
  return {
    executor: 'ramping-arrival-rate',
    exec: flow,
    startRate,
    timeUnit: '1m',
    preAllocatedVUs: VUS.preAllocated,
    maxVUs: VUS.max,
    stages,
  };
}

export type Phase = 'baseline' | 'surge' | 'peak' | 'decay';

// 평소 → 급증 → 피크 유지 → 감소의 홍보일 모양.
export class PromotionShape {
  constructor(private readonly peakSessionsPerSecond: number = PEAK.effectiveSessionsPerSecond) {}

  get totalSeconds(): number {
    return SHAPE.baselineSeconds + SHAPE.surgeSeconds + SHAPE.peakSeconds + SHAPE.decaySeconds;
  }

  phaseAt(seconds: number): Phase {
    if (seconds < SHAPE.baselineSeconds) {
      return 'baseline';
    }
    if (seconds < SHAPE.baselineSeconds + SHAPE.surgeSeconds) {
      return 'surge';
    }
    if (seconds < SHAPE.baselineSeconds + SHAPE.surgeSeconds + SHAPE.peakSeconds) {
      return 'peak';
    }
    return 'decay';
  }

  tags(): TagProvider {
    return (): Record<string, string> => {
      const seconds = elapsedSeconds();
      return seconds === undefined ? {} : { phase: this.phaseAt(seconds) };
    };
  }

  scenario(flow: string, share: number): Scenario {
    const peak = perMinute(this.peakSessionsPerSecond, share);
    const baseline = Math.max(1, Math.round(peak * SHAPE.baselineRatio));
    return arrival(
      [
        { duration: `${SHAPE.baselineSeconds}s`, target: baseline },
        { duration: `${SHAPE.surgeSeconds}s`, target: peak },
        { duration: `${SHAPE.peakSeconds}s`, target: peak },
        { duration: `${SHAPE.decaySeconds}s`, target: baseline },
      ],
      baseline,
      flow,
    );
  }
}

export const LADDER_LEVELS = [1, 2, 5, 10] as const;
// 단계마다 30초 상승 + 2분 유지. 로컬 점검에서는 환경 변수로 줄인다.
export const LADDER_RAMP_SECONDS = numberFromEnv('LADDER_RAMP_SECONDS', 30);
export const LADDER_HOLD_SECONDS = numberFromEnv('LADDER_HOLD_SECONDS', 120);

// 홍보일 피크 × 1 → 2 → 5 → 10으로 올리는 단계. 단계마다 상승 구간과 유지 구간이 있다.
export class SaturationLadder {
  constructor(private readonly peakSessionsPerSecond: number = PEAK.sessionsPerSecond) {}

  get totalSeconds(): number {
    return LADDER_LEVELS.length * (LADDER_RAMP_SECONDS + LADDER_HOLD_SECONDS);
  }

  holdStartSeconds(index: number): number {
    return index * (LADDER_RAMP_SECONDS + LADDER_HOLD_SECONDS) + LADDER_RAMP_SECONDS;
  }

  tagsAt(seconds: number): Record<string, string> {
    const slot = LADDER_RAMP_SECONDS + LADDER_HOLD_SECONDS;
    const index = Math.min(Math.floor(seconds / slot), LADDER_LEVELS.length - 1);
    const kind = seconds - index * slot < LADDER_RAMP_SECONDS ? 'ramp' : 'hold';
    return { stage: kind, level: `x${LADDER_LEVELS[index]}` };
  }

  tags(): TagProvider {
    return (): Record<string, string> => {
      const seconds = elapsedSeconds();
      return seconds === undefined ? {} : this.tagsAt(seconds);
    };
  }

  scenario(flow: string, share: number): Scenario {
    const rates = LADDER_LEVELS.map((level) => perMinute(this.peakSessionsPerSecond * level, share));
    const stages = rates.flatMap((rate) => [
      { duration: `${LADDER_RAMP_SECONDS}s`, target: rate },
      { duration: `${LADDER_HOLD_SECONDS}s`, target: rate },
    ]);
    return arrival(stages, rates[0], flow);
  }
}

export const ISOLATION = {
  beforeSeconds: numberFromEnv('ISOLATION_BEFORE_SECONDS', 240),
  duringSeconds: numberFromEnv('ISOLATION_DURING_SECONDS', 360),
  afterSeconds: numberFromEnv('ISOLATION_AFTER_SECONDS', 120),
};

// 일반 API를 피크 × 배수로 고정하고, 4분 뒤 AI 대화를 6분 투입한 뒤 2분 관찰한다.
export class IsolationShape {
  get totalSeconds(): number {
    return ISOLATION.beforeSeconds + ISOLATION.duringSeconds + ISOLATION.afterSeconds;
  }

  phaseAt(seconds: number): 'before' | 'during' | 'after' {
    if (seconds < ISOLATION.beforeSeconds) {
      return 'before';
    }
    return seconds < ISOLATION.beforeSeconds + ISOLATION.duringSeconds ? 'during' : 'after';
  }

  tags(): TagProvider {
    return (): Record<string, string> => {
      const seconds = elapsedSeconds();
      return seconds === undefined ? {} : { phase: this.phaseAt(seconds) };
    };
  }

  scenario(flow: string, share: number): Scenario {
    const rate = perMinute(PEAK.effectiveSessionsPerSecond, share);
    return arrival([{ duration: `${this.totalSeconds}s`, target: rate }], rate, flow);
  }
}
