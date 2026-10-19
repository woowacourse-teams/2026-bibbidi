import { numberFromEnv } from '../common/environment.ts';

// 부하 목표와 합격 기준(SLO)을 이 파일 한 곳에 모은다. 값은 환경 변수로 덮어쓸 수 있다.
// SLO와 단계 구성(Q2 ×1·2·5·10, Q3 4분·6분·2분)은 #456~#538에 적힌 값이다.
// 피크 크기·모양·흐름 비율은 이슈에 숫자가 없어서 아래 근거로 정한 값이고, "잠정" 표시가 있는 값은
// 팀 결정이나 홍보일 실측이 끝나면 여기서만 고친다.

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

// 급증 한 번에 신규 사용자 100명이 들어오는 것을 기준으로 잡았다.
//   - 지금 총 사용자는 17명이고 8주 안의 설계 상한이 1,000명이다(#456).
//   - 홍보일 실측: 오픈채팅에서 초반에 50명이 들어왔다(전체 사용자 약 213명). 목표 배수 ×2면 100명이다.
//   - Q2는 이 급증을 ×1·2·5·10으로 키워 한 번에 몰리는 신규가 100 → 200 → 500 → 1,000명이 되게 한다.
// 단위는 초당 시작하는 사용 흐름(세션) 수다. 신규 사용자 수 = 세션 × 신규 몫(MIX.newUser).
// 0.85 × 0.8 = 초당 신규 0.68명이고, 기본 Q1 모양에서 시험 전체의 신규가 약 100명, Q2 ×1 단계(2.5분)가 약 100명이다.
// 오픈채팅 50명이 도착한 시간 폭은 모르는 상태라 위 모양(급증 30초 + 피크 60초)은 가정이다.
// 목표 부하 배수(1배 또는 2배)는 팀 결정 대기라 PEAK_MULTIPLIER로 바꾼다.
export const PEAK = {
  sessionsPerSecond: numberFromEnv('PEAK_SESSIONS_PER_SECOND', 0.85),
  multiplier: numberFromEnv('PEAK_MULTIPLIER', 1),
  get effectiveSessionsPerSecond(): number {
    return this.sessionsPerSecond * this.multiplier;
  },
};

// 잠정: 오픈채팅처럼 한 번 몰렸다 끝나는 모양으로 잡았다(총 4.5분). 실제 도착 시간 폭은 모른다.
// #456은 일반적인 SNS 패턴(상승 1~2분, 피크 유지 10~15분, 반감 1시간)을 출발점으로 적었지만,
// 실측 유입(오픈채팅 50명, 총 약 213명)에는 10분 피크가 맞지 않아 짧게 줄였다.
export const SHAPE = {
  baselineSeconds: numberFromEnv('SHAPE_BASELINE_SECONDS', 60),
  surgeSeconds: numberFromEnv('SHAPE_SURGE_SECONDS', 30),
  peakSeconds: numberFromEnv('SHAPE_PEAK_SECONDS', 60),
  decaySeconds: numberFromEnv('SHAPE_DECAY_SECONDS', 120),
  // 평소 부하는 피크의 몇 배인지.
  baselineRatio: numberFromEnv('SHAPE_BASELINE_RATIO', 0.1),
};

// 잠정: 신규와 재방문 비율은 홍보일 실측으로 정한다. 근거 없는 60%는 폐기했다.
// 홍보일 사용자 약 213명 중 신규가 약 199명(약 93%)으로 보이지만 열의 뜻을 추정한 것이라 80%로 두었다.
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
