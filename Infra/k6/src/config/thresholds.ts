import type { Threshold } from 'k6/options';
import { SLO } from './targets.ts';

export type Thresholds = Record<string, Threshold[]>;

// 일반 API 응답을 나누어 판정하는 묶음. tags는 `phase:peak`나 `stage:hold,level:x2`처럼 쉼표로 이은 태그다.
export interface GatedGroup {
  tags: string;
  p95?: boolean;
  p99?: boolean;
  failure?: boolean;
  // 이 시간(초)이 지난 뒤에도 기준을 넘으면 테스트를 멈춘다. 없으면 기록만 하고 멈추지 않는다.
  abortAfterSeconds?: number;
}

// 보고서가 읽는 이름과 임계값 이름이 같아야 요약에 하위 지표가 나타난다. 두 곳 모두 이 함수로 만든다.
export function generalMetric(metric: string, tags: string): string {
  return `${metric}{kind:general,${tags}}`;
}

function gate(expression: string, abortAfterSeconds: number | undefined): Threshold {
  return abortAfterSeconds === undefined
    ? expression
    : { threshold: expression, abortOnFail: true, delayAbortEval: `${abortAfterSeconds}s` };
}

// 기준을 거는 항목은 SLO 값으로, 걸지 않는 항목은 요약에 나타나도록 항상 참인 식으로 둔다.
export function generalThresholds(groups: readonly GatedGroup[]): Thresholds {
  const thresholds: Thresholds = { [GENERAL_DURATION]: ['max>=0'] };

  for (const group of groups) {
    const durations: Threshold[] = [];
    if (group.p95) {
      durations.push(gate(`p(95)<${SLO.generalP95Ms}`, group.abortAfterSeconds));
    }
    if (group.p99) {
      durations.push(gate(`p(99)<${SLO.generalP99Ms}`, group.abortAfterSeconds));
    }
    thresholds[generalMetric('http_req_duration', group.tags)] = durations.length > 0 ? durations : ['max>=0'];
    thresholds[generalMetric('http_req_failed', group.tags)] = [
      group.failure ? gate(`rate<${SLO.generalFailureRate}`, group.abortAfterSeconds) : 'rate>=0',
    ];
    thresholds[generalMetric('http_reqs', group.tags)] = ['count>=0'];
  }

  // 여러 탭 동시 갱신의 응답 시간은 일반 API 판정과 따로 기록한다.
  thresholds[BURST_DURATION] = ['max>=0'];
  thresholds[BURST_REQUESTS] = ['count>=0'];
  // 동시 갱신에서 200 하나와 401 하나가 아닌 조합이 한 번이라도 나오면 실패한다. 동시 갱신이 없었으면 표본이 없어 통과한다.
  thresholds[REFRESH_VIOLATIONS] = ['count==0'];

  return thresholds;
}

// 일반 API 전체의 응답 시간. 요약표가 SSE(AI) 요청을 뺀 값을 읽도록 항상 선언한다.
export const GENERAL_DURATION = 'http_req_duration{kind:general}';
export const BURST_DURATION = 'http_req_duration{kind:refresh_burst}';
export const BURST_REQUESTS = 'http_reqs{kind:refresh_burst}';
export const REFRESH_VIOLATIONS = 'refresh_rotation_violations';

export const AI_OUTCOMES = ['completed', 'failure_event', 'rejected', 'disconnected', 'http_error'] as const;

// AI: 무응답(disconnected)과 서버 오류(http_error)는 0건이어야 한다. 나머지 결과는 기록만 한다.
export function aiThresholds(): Thresholds {
  const thresholds: Thresholds = {};

  for (const outcome of AI_OUTCOMES) {
    const forbidden = outcome === 'disconnected' || outcome === 'http_error';
    thresholds[`ai_turns{outcome:${outcome}}`] = [forbidden ? 'count==0' : 'count>=0'];
  }
  thresholds['ai_failure_ms'] = [`p(95)<${SLO.aiFailureResponseP95Ms}`];
  // TTFT는 참고 지표라 판정에 쓰지 않는다.
  thresholds['ai_ttft_ms'] = ['max>=0'];
  thresholds['ai_turn_ms'] = ['max>=0'];

  return thresholds;
}
