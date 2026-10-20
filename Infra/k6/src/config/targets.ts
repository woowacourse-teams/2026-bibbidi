import { numberFromEnv } from '../common/environment.ts';

// 부하 목표와 합격 기준(SLO)을 이 파일 한 곳에 모은다. 값은 #456의 잠정값이고 환경 변수로 덮어쓸 수 있다.
// "잠정" 표시가 있는 값은 팀 결정이나 홍보일 실측이 끝나면 여기서만 고친다.

export const SLO = {
  // 일반 API: 응답 시간과 실패율. k6 측정값으로 판정한다.
  generalP95Ms: numberFromEnv('SLO_GENERAL_P95_MS', 500),
  generalP99Ms: numberFromEnv('SLO_GENERAL_P99_MS', 1000),
  generalFailureRate: numberFromEnv('SLO_GENERAL_FAILURE_RATE', 0.001),
  // AI: 무응답 0건 > 턴 완료율 > TTFT(참고, 판정에 쓰지 않는다).
  aiCompletionRate: numberFromEnv('SLO_AI_COMPLETION_RATE', 0.99),
  aiTtftP95Ms: numberFromEnv('SLO_AI_TTFT_P95_MS', 3000),
  // 잠정: 실패 응답이 오기까지 걸린 시간 p95. 팀 결정 대기(수 초 이내).
  aiFailureResponseP95Ms: numberFromEnv('SLO_AI_FAILURE_P95_MS', 5000),
  // AI를 투입했을 때 일반 API p95가 투입 전의 몇 배까지 허용되는지.
  isolationRatio: numberFromEnv('SLO_ISOLATION_RATIO', 1.2),
};

// 잠정: 홍보일 실측 피크는 아직 없어서 작은 값으로 시작한다. 단위는 초당 시작하는 사용 흐름(세션) 수다.
// 목표 부하 배수(1배 또는 2배)는 팀 결정 대기라 PEAK_MULTIPLIER로 바꾼다.
export const PEAK = {
  sessionsPerSecond: numberFromEnv('PEAK_SESSIONS_PER_SECOND', 5),
  multiplier: numberFromEnv('PEAK_MULTIPLIER', 1),
  get effectiveSessionsPerSecond(): number {
    return this.sessionsPerSecond * this.multiplier;
  },
};

// 잠정: 홍보일 실측 전에는 일반적인 SNS 패턴(상승 1~2분, 피크 유지 10~15분, 반감)으로 시작한다.
export const SHAPE = {
  baselineSeconds: numberFromEnv('SHAPE_BASELINE_SECONDS', 60),
  surgeSeconds: numberFromEnv('SHAPE_SURGE_SECONDS', 120),
  peakSeconds: numberFromEnv('SHAPE_PEAK_SECONDS', 600),
  decaySeconds: numberFromEnv('SHAPE_DECAY_SECONDS', 300),
  // 평소 부하는 피크의 몇 배인지.
  baselineRatio: numberFromEnv('SHAPE_BASELINE_RATIO', 0.1),
};

// 잠정: 신규와 재방문 비율은 홍보일 실측으로 정한다. 근거 없는 60%는 폐기했다.
// 재방문 부하는 활성 비율이 낮아(DAU ÷ 30일 활성 약 5%) 신규 피크보다 작다고 가정한다.
export const MIX = {
  newUser: numberFromEnv('MIX_NEW_USER', 0.8),
  returningUser: numberFromEnv('MIX_RETURNING_USER', 0.1),
  catalogBrowse: numberFromEnv('MIX_CATALOG_BROWSE', 0.07),
  // 리프레시 토큰 동시 갱신(여러 탭)으로 findByTokenHashForUpdate 경로를 지나는 흐름의 몫.
  tokenRefresh: numberFromEnv('MIX_TOKEN_REFRESH', 0.03),
};

// 같은 토큰을 동시에 두 번 보내 여러 탭이 한꺼번에 갱신하는 상황을 만들 비율(0~1).
export const REFRESH_BURST_RATIO = numberFromEnv('REFRESH_BURST_RATIO', 0.3);

// 재방문 사용자 풀 크기. 같은 행을 여러 VU가 동시에 고쳐 잠금 경합이 실제보다 커지는 것을 피하려고 100명 이상으로 한다.
export const POOL_SIZE = numberFromEnv('POOL_SIZE', 100);

// 시드가 만든 리프레시 세션 수. 흐름마다 서로 다른 토큰을 한 번씩만 쓴다. generate-seed.py의 --refresh-sessions와 같아야 한다.
export const REFRESH_TOKEN_COUNT = numberFromEnv('REFRESH_TOKEN_COUNT', 5000);

// 화면 사이 생각하는 시간(초).
export const THINK = {
  minSeconds: numberFromEnv('THINK_MIN_SECONDS', 1),
  maxSeconds: numberFromEnv('THINK_MAX_SECONDS', 3),
};

// 도착률 시나리오의 VU 한도. 세션 하나는 생각 시간 때문에 수 초 이상 VU를 쓴다.
export const VUS = {
  preAllocated: numberFromEnv('PRE_ALLOCATED_VUS', 50),
  max: numberFromEnv('MAX_VUS', 300),
};

// Q5: 엔드포인트마다 동시 사용자 1000명을 1분간 유지한다. 엔드포인트는 차례로 하나씩 시험한다.
export const WORST_CASE = {
  users: numberFromEnv('WORST_CASE_USERS', 1000),
  holdSeconds: numberFromEnv('WORST_CASE_HOLD_SECONDS', 60),
  // 앞 엔드포인트의 느린 응답이 다음 구간에 섞이지 않게 두는 간격(초).
  gapSeconds: numberFromEnv('WORST_CASE_GAP_SECONDS', 15),
};
