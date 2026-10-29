# 밸런스 게임 측정 연결

[측정 계획](https://app.notion.com/p/408aec9466d680cf8348df97de240c83), [API PR #743](https://github.com/woowacourse-teams/2026-bibbidi/pull/743), [선택지 이미지 응답 PR #750](https://github.com/woowacourse-teams/2026-bibbidi/pull/750)을 기준으로 연결한다. 게임과 결과 카드는 공개하며, 실제 할 일 생성은 기존 회원용 API를 사용한다.

## 실제 제품 흐름

1. 공개 `GET /api/balance-game/questions`로 질문을 받는다. 서버 순서와 문자열 질문·선택지 ID를 유지하고, 선택지의 필수 문자열 `imageUrl`을 카드 이미지에 연결한다. 이미지 로딩에 실패하면 문구로 선택할 수 있다.
2. 첫 답변 선택을 게임 시작으로 센다. `UNKNOWN`은 제품의 건너뛰기이며 제출 답변에서 제외한다. 전부 건너뛰면 결과 요청을 보내지 않는다.
3. 공개 `POST /api/balance-game/results`에 `{ answers: { Q1: "A" } }` 형태로 답변을 보낸다.
4. 응답의 `id`를 `card_type`으로 사용한다. 같은 응답의 `catalogItemIds`를 공개 카탈로그에 대조해 추천 목록을 표시한다. 별도 추천 버튼·템플릿 적용·삭제된 `/recommendations` API를 추가하지 않는다.
5. 기존 보유 항목을 제외하고 기본 선택한다. 사용자가 필요한 항목만 남기고 저장하면 기존 `POST /api/checklists/me/catalog-items`로 할 일을 생성한다.
6. 비로그인은 저장 버튼에서 로그인한다. 결과·답변·최종 선택과 게임 연결 키를 같은 탭의 sessionStorage에 최대 30분 보관한다. OAuth·신규 가입 후 게임으로 복귀하되 자동 저장은 하지 않는다. 사용자가 다시 저장 버튼을 누른다.

## 도구별 전송

| 이벤트 | GA4 | PostHog | 발생 시점 |
| --- | --- | --- | --- |
| `page_view` | O | `$pageview` | 기존 라우터 계측 재사용 |
| `balance_game_start` | O | O | 플레이의 첫 답변 선택, 한 번 |
| `balance_game_question_view` | — | O | 문항 표시. 결과 요청 실패 후 재개도 별도 방문 |
| `balance_game_answer_select` | — | O | 실제 선택·변경. 같은 답 반복 선택 제외 |
| `balance_game_question_next` | — | O | 다음 문항·결과로 진행, API 호출 전 |
| `balance_game_answer_submit` | — | O | 결과 요청 시도 |
| `balance_game_card_view` | — | O | 유형 카드 표시 |
| `balance_game_recommendation_request` | — | O | 결과의 추천 ID를 카탈로그와 기존 보유 목록에 대조하는 로딩 시도 |
| `balance_game_recommendation_view` | — | O | 목록 준비 완료, 빈 목록도 수집 |
| `balance_game_task_select` | — | O | 개별·전체 선택/해제. 기본 선택 제외 |
| `balance_game_login_click` | — | O | 비로그인 사용자가 선택을 보관하고 로그인으로 이동 |
| `balance_game_save_submit` | — | O | 로그인 사용자의 유효한 저장 시도 |
| `balance_game_task_decision` | — | O | 저장 시도마다 저장 가능한 후보별 최종 선택 상태 |
| `balance_game_task_created` | — | O | 서버 생성 응답의 실제 할 일마다 출처 연결 기록 |
| `balance_game_save_success` | 신규 생성 > 0 | 0건 포함 | 서버 응답으로 확인된 신규 생성 수 |
| `balance_game_error` | — | O | questions / answers / recommendations / save 실패. 정상 취소 제외 |
| `checklist_task_view` | — | O | 회원의 할 일 상세 표시 |
| `checklist_task_status_change` | — | O | 상태 변경 성공. 확인 가능한 `from_status`, `to_status` |
| `checklist_task_complete` | 기존 유지 | O | 기존 완료 성공에 실제 할 일 ID 추가 |
| `appointment_create` | 기존 유지 | O | 기존 연결 일정 생성 성공에 실제 할 일 ID 추가 |
| `checklist_task_delete` | — | O | 할 일 삭제 성공 |

GA에는 게임 시작의 `source`, `auth_state`, `question_count`, 생성 성공의 `origin`, `card_type`, `created_count`, `auth_state` 등 요약만 보낸다. 상세 문항·플레이·실제 할 일 ID는 전달하지 않는다. 두 도구의 수치는 합산하지 않는다.

## 연결 키와 중복 집계

| 속성 | 의미 |
| --- | --- |
| `game_run_id` | 화면에서 시작한 플레이. API 재시도·로그인 복귀에도 유지 |
| `answer_revision` | 답을 새로 고르거나 바꿀 때 증가. 같은 답 반복·API 재시도는 유지 |
| `question_visit_id` | 문항 방문. 결과 요청 실패 후 재개는 새 방문 |
| `attempt_id` | 실제 요청/저장 작업 시도마다 새 UUID |
| `recommendation_id` | 성공한 결과 요청의 UUID. 서버 ID를 의미하지 않는다. 같은 답변으로 결과를 다시 받아도 별도 회차이며 로그인 복귀 시 유지 |
| `card_type` | 응답의 고정 유형 코드. 카드 제목·설명 원문은 전송하지 않음 |
| `decision_id` | `attempt_id:catalog_item_id`. 후보별 최종 선택 상태의 중복 제거 키 |
| `catalog_item_id` | 추천 카탈로그 ID |
| `checklist_item_id` | 서버가 실제 생성한 회원 할 일 ID |

`created_count`는 응답으로 신규 생성된 항목 수다. 요청 수·기존 항목·동시에 다른 곳에서 추가된 항목을 포함하지 않는다. 생성된 항목의 매핑은 생성 응답 직후 기록하므로 이후 UI 처리 실패와 분리할 수 있다. SDK 오류는 제품 저장 결과를 바꾸지 않는다.

항목별 최종 제외율은 `(game_run_id, recommendation_id)`의 **첫 저장 시도**에 속한 `task_decision`만 사용한다. `selected=false` 수 / 해당 항목 후보 수로 계산한다. 해제 후 다시 선택하면 제외가 아니다. 로그인 버튼 클릭은 저장 시도가 아니며 제외율 분모에도 넣지 않는다.

## 문항 시간과 중단

답변 카드를 누르면 선택을 기록하고 바로 다음 문항으로 진행한다. 마지막 문항은 방금 고른 답을 포함해 결과를 요청한다. 이전·다음 버튼과 결과 화면의 답변 수정 버튼은 제공하지 않는다. 결과 요청 재시도에서 같은 답을 다시 눌러도 답변 변경으로 기록하지 않는다. 결과는 카드 앞면 이미지만 표시하며, 별도의 제목·설명과 카드 클릭 동작은 제공하지 않는다.

`active_elapsed_ms`는 해당 문항 방문부터 누적한 활성 시간이다. `performance.now()`를 사용하고 탭 숨김·창 포커스 이탈을 제외한다. 카드 선택 후 문항 진행 시 시계를 멈춰 API 대기 시간을 제외한다.

- 첫 선택 시간: `answer_select`의 `is_first_selection=true`에서 중앙값·P90·표본 수를 본다.
- 문항 진행 시간: `question_next`의 활성 시간에서 중앙값·P90을 본다. 첫 방문과 retry 방문을 구분한다.
- 문항별 중단 후보: `(game_run_id, question_id)`의 첫 방문에 다음 진행이 없고 마지막 활동 후 30분이 지난 경우. 영구 이탈이나 불편의 원인으로 단정하지 않는다.
- 답변 변경은 `is_change`, 모르겠어요는 `option_id=UNKNOWN`으로 본다. 최종 답 분포는 제출 시점 전 각 문항의 마지막 선택을 사용하며 클릭 수를 분모로 삼지 않는다.

질문에 아무 조작 없이 브라우저를 닫은 경우 정확한 종료 시간은 수집하지 않는다. 이 방문은 문항 조회와 다음 진행 유무로 판단하고, 완료한 방문의 시간 통계와 구분한다.

## 저장 이후 활용 연결

2026-10-29 확정: **서버 API·DB 필드를 추가하지 않고 기존 응답의 실제 할 일 ID로 PostHog 이벤트를 연결한다.** 서버 출처 저장은 이번 구현의 완료 조건이나 선행 작업으로 두지 않는다. GA의 시작·신규 생성 성공, PostHog의 게임·추천·저장 이벤트 수집 범위는 유지한다.

현재 저장 API는 게임 출처를 받거나 반환하지 않는다. 서버 DB에 출처가 저장됐다고 가정하지 않고, `balance_game_task_created`에 다음 매핑을 남긴다.

`회원 + checklist_item_id → catalog_item_id, origin, card_type, game_run_id, recommendation_id, attempt_id`

후속 이벤트는 현재 화면의 `source`와 실제 `checklist_item_id`를 보낸다. PostHog SQL에서 **같은 회원의 같은 실제 할 일 ID**로 생성 매핑과 연결한다. 회원 식별이 유지되면 새로고침·재방문·다른 기기에서도 조회할 수 있고, 나중에 다시 게임을 해도 원래 유형을 덮어쓰지 않는다. 카탈로그 ID만으로 연결하면 기존에 보유한 항목·재생성한 항목이 섞이므로 사용하지 않는다.

이벤트 기반 연결은 생성 매핑이 차단·유실되면 복구할 수 없다. 저장 이후 추천 활용 지표는 생성 매핑이 확인되는 표본을 기준으로 보고하고, 연결되지 않은 활동을 추천 미활용으로 단정하지 않는다. 전체 신규 생성 성공자 수와 후속 연결이 가능한 사용자 수를 함께 표시한다. GA 후속 완료·일정 이벤트에는 확인되지 않은 `origin`/`card_type`을 추정해 넣지 않는다.

PostHog에서 구성할 지표:

| 지표 | 집계 기준 |
| --- | --- |
| 게임 완주율 | 24시간 내 start → card_view, `game_run_id`별 중복 제거 |
| 카드 유형별 저장률 | eligible_count > 0인 목록 → created_count > 0, 같은 recommendation_id·card_type |
| 추천 활용률 | 생성 매핑이 확인되는 첫 신규 생성 성공자 중 7일 내 그 생성 항목의 `to_status=continue/done` 또는 연결 `appointment_create`. 사용자당 한 번, 7일 관찰 완료자만 분모 |
| 재방문 준비 행동률 | 생성 매핑이 확인되는 사용자 중 첫 생성 후 28일 내 다른 `$session_id`에서 상태 변경·관련 일정 생성·완료. 단순 방문 제외, 28일 관찰 완료자만 분모 |
| 추천 삭제율 | 생성 매핑이 확인되는 항목 중 7일/28일 내 같은 실제 ID 삭제, 관찰 완료 항목만 분모 |
| 저장 실패율 | save_submit의 attempt_id 중 save 단계 오류. 성공·실패가 없는 요청은 미확인 |

활용 여부는 `status_change`와 기존 `complete`를 중복 합산하지 않는다. 28일 재방문에서 전체 서비스 준비 행동과 추천 항목 자체 활용은 별도로 보고한다.

## API에서 아직 제공하지 않는 값

- `game_version=results-v1`은 현재 FE/API 계약 버전이다. S3의 질문·유형 콘텐츠 버전이 아니다. 콘텐츠 변경 전후 비교를 정확히 하려면 BE 응답에 콘텐츠 버전이 필요하다.
- 서버 result_id/recommendation_id/save_id는 없다. 임의의 값을 서버 ID로 가장하지 않고 위 프런트 연결 키를 쓴다.
- 별도 게임 진입 버튼이 없는 현재 화면에서는 entry_source를 추정하지 않는다. 향후 실제 진입 지점에 고정 분류를 연결한다. 채널·캠페인은 기존 GA 유입과 PostHog UTM을 사용한다.

## 배포와 수신 확인

기존 SDK 초기화·회원 identify/reset·속성 허용 목록·리플레이 마스킹 정책을 재사용한다. `/balance-game`을 공개 분석 경로에 추가한다. 답변 리스트는 제품 API에만 보내며, 분석에는 고정 ID·선택 코드·개수·시간만 보낸다. 제목·메모·카드 설명·닉네임·토큰·OAuth 값·원문 오류를 보내지 않는다.

1. FE 빌드 환경의 `BIBBIDI_GA_MEASUREMENT_ID`, `BIBBIDI_POSTHOG_ENABLED=true`, `BIBBIDI_POSTHOG_PROJECT_TOKEN`, `BIBBIDI_POSTHOG_HOST`를 기존 프로젝트 값으로 설정한다. `.env.example`과 [PostHog 운영 문서](./posthog.md)를 따른다. 값은 빌드 시 주입되므로 변경 시 재빌드한다.
2. #743의 공개 질문·결과 API와 기존 회원 할 일 생성 API를 사용하는 환경에 배포한다.
3. GA에서 `balance_game_save_success`를 주요 이벤트로 지정하고 card_type/origin/auth_state를 필요한 이벤트 범위 맞춤 측정기준, created_count를 측정항목으로 등록한다. 개별 ID를 GA 측정기준으로 등록하지 않는다.
4. 개발 트래픽으로 비로그인 플레이 → 카드 → 선택 해제/복원 → OAuth/가입 복귀 → 생성 → 실제 생성 항목 상세·진행·일정·완료·삭제를 확인한다. GA DebugView와 PostHog 수신 화면에서 요약/상세 분리와 실제 ID 연결을 확인한다.
5. 운영 분석은 environment=production과 기존 내부 트래픽 제외 기준을 적용한다. SDK 차단·종료로 누락될 수 있으므로 서버의 생성 건수와 행동 분석 수치를 구분한다.

자동 테스트는 이벤트 발생·필터·로그인 복원·중복 방지·실패 처리까지 검증한다. 원격 GA 설정, PostHog 대시보드 생성 및 실제 서비스 수신 검증은 로컬 테스트 통과와 별개다.

참고: [GA 이벤트 전송·DebugView](https://developers.google.com/analytics/devguides/collection/ga4/events), [PostHog 회원 식별](https://posthog.com/docs/product-analytics/identify), [PostHog SQL 속성 조회](https://posthog.com/docs/data-warehouse/sql/data-access).
