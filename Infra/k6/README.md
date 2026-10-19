# k6 부하 테스트

전용 부하 테스트 환경(`Infra/loadtest`)에서 `k6/loadtest/<스크립트>/<회차>` 태그로 실행한다. 목표 부하, 합격 기준(SLO), 흐름 비율은 [`src/config/targets.ts`](src/config/targets.ts) 한 곳에 있고 값은 환경 변수로 덮어쓴다. 표시된 값은 #456의 잠정값이다.

## 스크립트

| 스크립트 | 목적 | 판정 |
| --- | --- | --- |
| `smoke-test` | 일반 흐름 4종을 한 번씩 돌려 본다 | 응답 검사 100%, 5xx 0건 |
| `smoke-ai-test` | 모의 모델과 SSE 경로 확인(질문 3턴) | 무응답 0건 |
| `ttft-ai-test` | AI 첫 토큰 시간(TTFT) 측정 | 판정 없음 |
| `surge-test` (Q1, #535) | 평소 → 급증 → 피크 유지 → 감소의 홍보일 모양 재현 | `surge` p99·실패율, `peak` p95·p99·실패율 |
| `saturation-test` (Q2, #536) | 피크 ×1·2·5·10 단계(30초 상승 + 2분 유지)로 올려 포화점 찾기 | 유지 구간 p99·실패율. 깨지면 중단(종료 코드 99) |
| `ai-isolation-test` (Q3, #537) | 일반 API 고정 + AI 대화 6분 투입(4분 뒤)으로 격리 확인 | 투입 중 p95 ≤ 투입 전의 1.2배, AI 무응답 0건 |
| `ai-throttle-test` (Q4, #538) | 모의 모델이 한도 초과를 낼 때 구분된 실패 안내로 끝나는지 | 무응답·서버 오류 0건 |

실제 Bedrock은 부르지 않는다(모의 모델). `ai-throttle-test`의 실패 비율은 스크립트가 아니라 모의 모델 설정(`LoadTestThrottleRatio`)으로 정한다.

## 사용 흐름

일반 API 부하는 흐름마다 시나리오(`ramping-arrival-rate`)를 따로 두고, 몫만큼 도착률을 나눠 비율을 맞춘다. 화면 사이에는 1~3초(`THINK_MIN_SECONDS`, `THINK_MAX_SECONDS`) 쉰다.

| 흐름 | 순서 | 잠정 몫 |
| --- | --- | --- |
| 신규 | 준비 목록 둘러보기 → 체크리스트 만들고 담기 → 일정 잡기 → 홈 | 80% |
| 재방문 | 홈 → 체크리스트 확인 → 일정 완료 표시 | 10% |
| 카탈로그 조회 | 카탈로그만 보고 나감 | 7% |
| 토큰 갱신 | 세션 갱신(`/api/auth/native/sessions/refresh`) → 홈 | 3% |
| AI | 질문 3턴 | Q3·Q4와 스모크에서만 |

- 홈은 API 4개를 `http.batch`로 동시에 부른다.
- 재방문 풀은 100명이다(`POOL_SIZE`). 같은 행을 여러 VU가 동시에 고쳐 잠금 경합이 실제보다 커지는 것을 피한다.
- 토큰 갱신은 시드(`sql/generate-seed.py`)가 만든 리프레시 세션(기본 5000개, `loadtest-refresh-<번호>`)을 반복 번호마다 하나씩, 한 번만 쓴다. 30%(`REFRESH_BURST_RATIO`)는 같은 토큰을 동시에 두 번 보내 여러 탭의 동시 갱신을 만든다. 서버는 `findByTokenHashForUpdate`로 행을 잠그고, 두 번째는 재사용으로 401을 받는다. 이 요청은 `kind=refresh_burst`로 따로 태그해 일반 API 판정에서 뺀다. 시드의 세션 수와 `REFRESH_TOKEN_COUNT`는 같아야 한다.

## 지표와 판정

- k6 기본 지표(`http_req_duration`, `http_req_failed`, `http_reqs`)에 태그를 붙여 나눈다. `kind`(`general`·`ai`·`refresh_burst`), `phase`(`baseline`·`surge`·`peak`·`decay` / `before`·`during`·`after`), `stage`(`ramp`·`hold`), `level`(`x1`~`x10`).
- AI는 `ai_turns`(`outcome`: `completed`·`failure_event`·`rejected`·`disconnected`·`http_error`), `ai_ttft_ms`, `ai_turn_ms`, `ai_failure_ms`를 보낸다.
- `dropped_iterations`는 중단하지 않고 기록만 한다. 부하 발생기 한계와 서버 한계는 서버 지표로 가른다.
- 하위 지표는 임계값을 선언해야 요약에 나타난다. 보고서가 읽는 이름과 임계값 이름은 `src/config/thresholds.ts`의 같은 함수로 만든다.
- 결과 보고서(`report.md`)와 `summary.json`은 워크플로 아티팩트로 남는다.

## 로컬에서 돌려 보기

```bash
cd Infra/k6
npm install            # @types/k6, typescript
npx tsc --noEmit       # 타입 검사
BASE_URL=http://localhost:8080 AUTH_JWT_SECRET=... k6 run smoke-test.ts
```

AI 스크립트는 SSE 확장이 든 k6가 필요하다(`xk6 build v2.2.0 --with github.com/phymbert/xk6-sse@v0.2.0`). 단계·관찰 시간은 `SHAPE_*_SECONDS`, `LADDER_RAMP_SECONDS`, `LADDER_HOLD_SECONDS`, `ISOLATION_*_SECONDS`로 줄일 수 있다. 시드한 리프레시 토큰은 한 번만 쓸 수 있으니 같은 DB에서 토큰 갱신이 있는 스크립트를 연달아 돌리려면 `refresh_sessions`를 다시 시드한다.

## 알려진 한계

- 홍보일 실측 피크·모양·신규/재방문 비율이 아직 없어 `PEAK_SESSIONS_PER_SECOND`(기본 5)와 모양, 비율은 임시값이다. 목표 배수(1배 또는 2배)는 팀 결정 대기라 `PEAK_MULTIPLIER`로 바꾼다.
- AI 실패 응답 시간 p95 기준(`SLO_AI_FAILURE_P95_MS`, 기본 5000)은 팀 결정 대기다.
- VU는 시나리오마다 `MAX_VUS`(기본 300)까지 늘어난다. 부하 발생기 메모리(t4g.small 2GB)를 넘는 단계에서는 `dropped_iterations`가 늘어난다.
- Q3의 격리 비율(투입 중 ÷ 투입 전 p95)은 k6 임계값으로 표현할 수 없어 보고서에서만 판정한다.
