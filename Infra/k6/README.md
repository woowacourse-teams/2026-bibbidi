# k6 부하 테스트

전용 부하 테스트 환경(`Infra/loadtest`)에서 `k6/loadtest/<스크립트>/<회차>` 태그로 실행한다. 목표 부하, 합격 기준(SLO), 흐름 비율은 [`src/config/targets.ts`](src/config/targets.ts) 한 곳에 있고 값은 환경 변수로 덮어쓴다. SLO와 단계 구성은 이슈에 적힌 값이고, 피크 크기·모양·흐름 비율은 아래 "시나리오 크기"의 근거로 정한 임시값이다.

## 시나리오 크기

급증 한 번에 **신규 사용자 100명**이 들어오는 것을 기준으로 한다. 지금 총 사용자는 17명이고 8주 안의 설계 상한이 1,000명이며, 홍보일 실측은 오픈채팅에서 초반에 50명이 들어왔다(전체 약 213명). 목표 배수 ×2면 100명이다. Q2는 이 급증을 ×1·2·5·10으로 키워서 한 번에 몰리는 신규가 100 → 200 → 500 → 1,000명이 되는 여정이다. 시드의 1,000명은 시험 시작 때 이미 DB에 있는 데이터이고(#528), 그 위에 아래 신규가 더해진다.

| 시험 | 만들어지는 신규 사용자(기본값, 근사) |
| --- | --- |
| Q1 `surge-test` | 시험 전체 약 100명(평소 4 + 급증 11 + 피크 41 + 감소 45) |
| Q2 `saturation-test` | 단계별 약 100 / 190 / 480 / 970명, 합계 약 1,740명 |
| Q3 `ai-isolation-test` | 일반 API 신규 약 490명 + AI 대화(사용자마다 새 ID) |

산식: 신규 = 초당 세션(`PEAK_SESSIONS_PER_SECOND` 0.85) × 신규 몫(0.8) × 시간. 오픈채팅 50명이 도착한 시간 폭을 몰라서 Q1 모양(평소 60초, 급증 30초, 피크 60초, 감소 120초)은 가정이다. VU는 약 50개면 충분해서(×10 단계 초당 8.5세션 × 약 6초) 부하 발생기 한도(300)에는 한참 못 미친다.

## 스크립트

| 스크립트 | 목적 | 판정 |
| --- | --- | --- |
| `smoke-test` | 일반 흐름 4종을 한 번씩 돌려 본다 | 응답 검사 100%, 5xx 0건 |
| `smoke-ai-test` | 모의 모델과 SSE 경로 확인(질문 3턴) | 무응답 0건 |
| `ttft-ai-test` | AI 첫 토큰 시간(TTFT) 측정 | 판정 없음 |
| `surge-test` (Q1, #535) | 평소 → 급증 → 피크 유지 → 감소의 홍보일 모양 재현 | `surge` p99·실패율, `peak` p95·p99·실패율 |
| `saturation-test` (Q2, #536) | 피크 ×1·2·5·10 단계(30초 상승 + 2분 유지)로 올려 포화점 찾기 | 유지 구간 p99·실패율. 깨지면 중단(종료 코드 99) |
| `ai-isolation-test` (Q3, #537) | 일반 API 고정 + AI 대화 6분 투입(4분 뒤)으로 격리 확인 | 투입 중 p95 ≤ 투입 전의 1.2배(비율은 `verdict.json`으로 워크플로가 판정), AI 무응답 0건 |
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
- 토큰 갱신은 시드(`sql/generate-seed.py`)가 만든 리프레시 세션(기본 5000개, `loadtest-refresh-<번호>`)을 반복 번호마다 하나씩, 한 번만 쓴다. 30%(`REFRESH_BURST_RATIO`)는 같은 토큰을 동시에 두 번 보내 여러 탭의 동시 갱신을 만든다. 쌍의 응답이 정확히 200 하나와 401 하나가 아니면 `refresh_rotation_violations`가 올라가고 임계값(`count==0`)이 실패한다. 서버는 `findByTokenHashForUpdate`로 행을 잠그고, 두 번째는 재사용으로 401을 받는다. 이 요청은 `kind=refresh_burst`로 따로 태그해 일반 API 판정에서 뺀다. 시드의 세션 수와 `REFRESH_TOKEN_COUNT`는 같아야 한다.

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

- 홍보일 실측 도착 시간 폭·모양·신규/재방문 비율이 아직 없어 `PEAK_SESSIONS_PER_SECOND`(기본 0.85)와 모양, 비율은 임시값이다. 목표 배수(1배 또는 2배)는 팀 결정 대기라 `PEAK_MULTIPLIER`로 바꾼다.
- AI 실패 응답 시간 p95 기준(`SLO_AI_FAILURE_P95_MS`, 기본 5000)은 팀 결정 대기다.
- VU는 시나리오마다 `MAX_VUS`(기본 300)까지 늘어난다. 부하 발생기 메모리(t4g.small 2GB)를 넘는 단계에서는 `dropped_iterations`가 늘어난다.
- Q3의 격리 비율(투입 중 ÷ 투입 전 p95)은 k6 임계값으로 표현할 수 없다. 스크립트가 `verdict.json`을 내보내고 워크플로의 `AI 격리 비율 판정` 단계가 잡의 성패를 정한다. 파일이 없거나 구간에 요청이 없어 비율을 구하지 못해도 실패로 본다. 로컬에서 k6만 돌릴 때는 종료 코드에 비율이 반영되지 않으니 `report.md`를 본다.
