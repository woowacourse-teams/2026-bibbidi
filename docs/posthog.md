# PostHog 사용자 여정 계측 설계와 운영 절차

Issue: [#300](https://github.com/woowacourse-teams/2026-bibbidi/issues/300). 2026-09-29 수정.
FE 기준 `dev-fe@4b118bb8`, BE 계약 확인 `dev-be@6250f75c`.

## 목적과 범위

회원 `bibbidi:user:{id}`의 방문별 이벤트 순서와 마스킹된 리플레이를 함께 본다. GA는 유지하고 기존 AnalyticsProvider에 PostHog를 추가한다. SDK의 distinct ID와 session ID를 사용한다. 브라우저 분석은 감사 로그나 정확한 업무 처리 건수의 원장이 아니다.

카카오·구글 로그인만 연결되어 있고 Apple은 준비 중이다. `/signup`은 `/login`으로 리다이렉트한다. 기존 `login`, `sign_up` 이벤트는 없으며 재사용 대상으로 간주하지 않는다. 로그인 콜백 응답에는 `accessToken`, `termsAgreementRequired`만 있다. 식별에 사용하는 회원 ID는 `/api/users/me`의 `id`다.

## 회원 식별과 페이지

```text
/login → 제공자 → /auth/:provider → /onboarding → /onboarding/account
   익명           녹화 제외          익명              익명
                                            new 또는 legacy 처리
                                                ↓
                            /me 조회 + 체크리스트 조정 완료(authenticated)
                                                ↓
                               identify(bibbidi:user:{최종 id})
```

- `loading`, `synchronizing`, `error`: 일반 이벤트와 녹화를 보류한다. 네트워크 오류만으로 reset하지 않는다.
- `guest`, `onboardingRequired`, `accountSetupRequired`: 익명으로 수집한다. `/onboarding`, `/onboarding/account`를 페이지 정의에 추가한다.
- `authenticated`에서만 `/me.id`로 identify한다. 닉네임·이메일·JWT sub를 식별이나 Person 속성으로 보내지 않는다.
- 기존 회원 이전은 임시 회원을 삭제하고 소셜 식별자를 기존 회원으로 이동한다. 따라서 임시 ID는 identify하지 않으며, 약관 동의와 이전 처리 사이의 로딩으로 익명 ID를 reset하지 않는다.
- 로그아웃 성공 이벤트를 기존 ID에 보낸 뒤 reset한다. 명시적 계정 전환·탈퇴 완료도 reset한다. 401/회원 없음으로 세션 무효가 확정되면 기존 회원 식별을 해제한다.
- 익명 상태의 reset은 SDK ID를 바꾸지 않는다. 녹화와 일반 이벤트 수집은 중지하되 가입 중 세션 만료 전후의 익명 여정을 연결한다.
- 1차 목표는 홍보로 들어온 비로그인 방문자를 한 명씩 추적하는 것이다. 그래서 SDK 식별 저장소는 `localStorage`로 두어 같은 브라우저의 재방문과 새 탭을 같은 익명 방문자로 잇고, `person_profiles: "always"`로 익명 방문자도 People에 한 명씩 남긴다. 로그인하면 그동안의 익명 기록이 최종 회원에 합쳐진다. 다른 기기나 브라우저는 로그인 전까지 다른 방문자로 잡힌다.
- 탭들이 식별 저장소를 공유하므로, 한 탭에서 로그아웃하거나 다른 회원으로 로그인하면 아직 갱신되지 않은 다른 탭의 이벤트가 바뀐 ID로 기록될 수 있다. 이 경우는 드물다고 보고 탭 간 동기화는 넣지 않는다.
- 다른 탭에서 로그아웃하거나 계정이 바뀌면, 이 탭은 토큰이 만료돼 401이 날 때 식별을 해제한다. 그 전까지는 이 탭이 실제로 기존 회원으로 요청하므로 기존 회원에 기록된다.
- `/auth/:provider`는 페이지뷰·리플레이 대상에서 제외한다. 콜백 실패는 제공자와 고정 사유만 별도 이벤트로 보낸다. 초기 인증 확인 중이어도 이 실패는 익명으로 남긴다.

## 이벤트 계약

`page_view`만 PostHog의 `$pageview`로 매핑한다. 기존 GA 이벤트 이름과 의미는 유지한다.

| 이벤트 | 발생 지점 / 속성 |
| --- | --- |
| 기존 preparation, checklist, planner, appointment_create, logout, feedback_submit | 기존 명시적 계측 재사용. login/sign_up은 제외 |
| social_login_start | 연결된 제공자 버튼으로 인가 시작, provider=kakao/google |
| social_login_start_failed | 인가 URL 요청 실패, provider, failure_kind=network/timeout/api/unknown |
| social_login_callback_failed | callback 오류, provider=kakao/google/unknown, failure_kind=cancelled/invalid_callback/state_invalid_or_expired/network/timeout/api/unknown |
| social_login_callback_complete | 콜백 API 성공, provider, terms_required. 로그인 완료와 구분 |
| onboarding_terms_complete | 약관 동의 성공 또는 응답 유실 후 성공 확인 |
| account_setup_choice | 사용자가 new/legacy를 선택한 시점, choice |
| legacy_transfer_submit | 검증 통과 후 이전 요청 직전 |
| legacy_transfer_failed | validation/authentication/terms_required/network/timeout/api/unknown. 네트워크 응답 유실 후 성공 여부가 불명확하면 outcome=unknown |
| legacy_transfer_complete | 이전 성공 또는 응답 유실 후 성공 확인. 아직 익명 |
| account_setup_complete | 새 계정 생성/기존 회원 이전 완료, choice |
| appointment_form_view | 일정 폼 닫힘→열림, source=checklist/planner |
| appointment_submit | 검증 통과 후 실제 저장 시도, source. 목록 재조회만 하는 재시도는 제외 |
| appointment_create_failed | 입력 검증/저장 실패. 저장 후 목록 재조회 실패는 제외 |

서버의 208은 state 불일치, 만료, 쿠키 바인딩 실패를 함께 나타낸다. FE에서 구분할 수 없으므로 `state_invalid_or_expired`로 묶는다. 취소는 제공자가 `error=access_denied`로 돌려준 경우다. 제공자 화면에서 돌아오지 않은 사용자는 실패 이벤트가 없고 시작 후 다음 단계가 관측되지 않은 방문으로만 해석한다.

오류 메시지·원문 응답·닉네임·비밀번호·토큰·OAuth code/state·제목·피드백·장소·메모·일정 일시는 전송하지 않는다. 이벤트별 고정 속성과 카탈로그 ID·이름·단계만 사용한다. `page_title`은 페이지 정의의 고정 제목만 허용하고 SDK 자동 `$title`은 제거한다. 페이지 URL은 알려진 경로와 origin만 남긴다. Web analytics의 경로 표에 쓰는 `$pathname`·`$session_entry_pathname`도 공개 경로일 때만 남기고, `$host`는 그대로 둔다. `environment`와 `app_version`은 SDK 공통 속성으로 등록해 `$identify` 같은 SDK 이벤트에도 붙인다. PostHog의 테스트 계정 필터는 `environment ≠ development`로 두어 테스트 서버 기록을 뺀다. 홍보 유입 분석을 위해 `utm_source`·`utm_medium`·`utm_campaign`·`utm_content`·`utm_term`과 유입 도메인(`$referring_domain`)은 이벤트·세션 진입값(`$session_entry_*`)·Person 첫 유입값(`$initial_*`)으로 남긴다. 전체 URL과 referrer 원문(`$referrer`, `$session_entry_url`, `$initial_current_url` 등)은 쿼리에 OAuth 값이 섞일 수 있어 계속 제거한다. 신규 일정 이벤트는 저장 성공과 목록 새로고침 실패를 구분하며, 기존 appointment_create는 현행 의미를 유지한다.

## SDK와 리플레이

공식 `posthog-js` 고정 버전을 사용한다. `autocapture`, 자동 pageview/pageleave, dead click, heatmap, 성능, 예외, 콘솔, 네트워크 본문·헤더, canvas, JSON-LD, survey와 실험 수집을 끈다. IP 수집은 SDK 옵션으로는 끌 수 없다. PostHog 프로젝트 설정 **Discard client IP data**를 켠다. 원격 Replay 설정을 받는 요청 자체를 끄지는 않는다.

입력 전체와 DOM 텍스트 전체를 마스킹한다. DOM 속성은 CSS class/고정 구조 속성 및 rrweb이 생성한 스타일시트 `_cssText` 외에는 마스킹하고 이미지·SVG·미디어·iframe·canvas를 차단한다. 녹화는 레이아웃·클릭·스크롤과 이벤트를 함께 보는 용도다. 자유 입력을 저장한 뒤 카드에 표시되는 텍스트도 마스킹 대상이다. URL 정제는 일반 이벤트와 replay URL 각각에 적용한다. 쿼리·해시, 초기 유입 URL, referrer, 캠페인 파라미터와 자동 Person 속성이 우회해서 남지 않게 허용 목록으로 제한한다. GA로 전달하는 콜백 이벤트도 원본 주소 대신 고정 경로 `/auth/callback`을 사용한다.

인증 상태와 경로가 허용될 때만 녹화를 시작한다. 콜백 진입과 인증 재확인 시 중지한다. 원격 프로젝트에서도 녹화 제외 URL(URL blocklist)에 `.*/auth/.*`를 추가한다. PostHog는 정규식 앞뒤에 `^`·`$`를 붙여 전체 URL과 비교하므로 `/auth/.*`만 넣으면 콜백 URL에 걸리지 않는다. SDK/원격 설정 변경 시 payload와 실제 재생을 다시 검증한다.

인증 전환·녹화 중지 때 아직 전송되지 않은 마지막 녹화 버퍼가 폐기될 수 있다. 종료 지점은 명시적 이벤트와 함께 판단한다. 잘못된 회원이나 콜백에 귀속되는 영상보다 일부 영상 누락을 허용하는 선택이다. SDK 외부 recorder도 고정 버전만 로드하며 지원되지 않으면 원격 최신 버전으로 자동 대체하지 않는다.

## 비용과 보관

PostHog Cloud **US 리전** (`https://us.i.posthog.com`, 관리 UI `https://us.posthog.com`)을 사용한다. 처리방침에 이미 미국(GA4, Discord)이 이전 국가로 있어 이전 국가는 늘지 않고 수탁자만 추가된다. 리전은 프로젝트 생성 뒤 바꿀 수 없으므로 프로젝트를 만들 때 US로 선택하고, 계약상 수탁자 연락처·하위처리자는 [DPA](https://posthog.com/dpa)와 [subprocessors](https://posthog.com/subprocessors)로 확정한다. US 프로젝트에 EU 수집 호스트를 섞지 않는다.

제품별 월 과금 상한을 $0으로 설정한다. 조사 시 무료량은 분석 월 100만 이벤트, 녹화 월 5천 세션이다. 처음에는 녹화율 100%, 최소 녹화 시간 필터 없음으로 시작하고 일주일 수집량으로 조정한다. 상한 초과·광고 차단·네트워크 실패로 누락될 수 있으므로 모든 회원의 모든 행동을 보장하지 않는다. [가격](https://posthog.com/pricing)

수집한 제품 이벤트는 최대 1년, 리플레이는 무료 플랜의 1개월을 기준으로 운영한다. 실제 프로젝트의 retention 설정과 계약을 활성화 전 확인한다. 과금 변경으로 보관 기간을 자동 연장하지 않는다. 식별된 Person은 탈퇴 시 아래 절차로 삭제한다. SDK의 익명 식별 저장은 탭 세션 동안 유지한다. 향후 더 짧은 이벤트 보관이 필요하면 실제 설정 지원 여부 또는 별도 정기 삭제 절차를 먼저 검증한다.

## 탈퇴 데이터 삭제

BE의 `DELETE /api/users/me`는 재인증 deleteGrant를 검증한 뒤 회원을 삭제한다. FE에 탈퇴 UI는 아직 없다. FE에는 탈퇴 API 연결 코드도 없다. 탈퇴 UI를 구현할 때 성공 후 `analytics.reset()`을 호출하고 인증을 종료해야 하며 deleteGrant를 분석에 넣지 않는다. 다른 기기에서 탈퇴한 회원은 다음 인증 재확인/만료에서 수집을 중단한다.

BE 서버의 PostHog 삭제 자동 호출은 이번 범위에 포함하지 않는다. 탈퇴 목록과 삭제 담당자는 운영 수집과 별개로 후속 작업에서 마련한다. FE 이벤트만으로 삭제 대상을 만들면 광고 차단·종료 시 누락되므로 금지한다.

운영 절차:

1. BE 담당자가 탈퇴 트랜잭션 성공 후 확인 가능한 회원 ID 목록을 제공한다. 현재 서비스에 이 기록이 없으므로 별도 서버 작업 또는 수동 탈퇴 접수 과정으로 누락 없는 목록을 확보해야 한다.
2. 지정 담당자가 탈퇴 당일, 늦어도 24시간 내 `bibbidi:user:{id}`를 People에서 찾는다. PostHog Person UUID와 병합된 익명 ID를 확인한다. 관리 키는 FE/Issue/로그에 넣지 않는다.
3. People의 Delete person에서 **이벤트와 녹화도 삭제**하도록 선택한다. API를 쓰면 US 관리 API(`https://us.posthog.com`)의 `/api/projects/{project_id}/persons/{person_uuid}/?delete_events=true&delete_recordings=true`에 DELETE한다. 숫자 회원 ID를 Person UUID 자리에 넣지 않는다.
4. 삭제는 비동기다. 요청 성공만으로 완료 처리하지 않고 해당 Person·이벤트·녹화 조회와 삭제 작업 상태를 재확인한다. 실패 시 재시도하고 미완료 요청을 매일 점검한다. 최초 24시간 내 접수 목표와 실제 영구 삭제 완료 시각을 구분해 기록한다.
5. 감사 기록에는 회원 ID, 요청/검증 시각, 담당자, 결과만 최소한으로 두고 내부 보관 정책에 따른다. 탈퇴 회원 ID를 재사용하지 않는다. 이미 탈퇴한 회원의 늦은 이벤트가 재생성되지 않는지도 확인한다.

한 번도 identify하지 않은 익명 방문은 회원 ID로 역조회할 수 없으므로 회원 탈퇴 목록으로 삭제를 보장할 수 없다. 이 경우 보관 만료, 또는 당사자가 제공한 익명 식별자로 별도 삭제한다. [People 삭제](https://posthog.com/docs/data/persons), [데이터 삭제](https://posthog.com/docs/privacy/data-storage)

## 처리방침과 배포 순서

2026-09-26 처리방침에는 GA4(미국), Grafana Cloud(일본), Discord(미국)만 기재되어 있다. PostHog 수탁자와 방문자 식별자 저장은 아직 방침에 없다.

1. 테스트 서버와 운영은 PostHog 프로젝트 하나를 함께 쓴다. 두 CodeBuild 환경에 `BIBBIDI_POSTHOG_ENABLED=true`, `BIBBIDI_POSTHOG_PROJECT_TOKEN`, `BIBBIDI_POSTHOG_HOST`를 넣는다. 테스트 서버는 `BIBBIDI_APP_ENV=development`를 넣고, 운영은 비워 두면 `production`이 들어간다.
2. 값이 없거나 키가 없으면 초기화·저장·전송하지 않고 빌드는 성공한다. 배포 후 PostHog 이벤트 화면에서 `environment = production` 이벤트가 들어오는지 확인한다. 빌드 시 주입 값이라 변경 시 재빌드·재배포가 필요하다.
3. 운영 수집은 처리방침 개정보다 먼저 켠다(2026-09-29 결정). 처리방침 개정은 후속 작업이다. 3번 위탁·국외 이전에 PostHog Inc.(미국)와 수집 항목(회원 ID, 행동 이벤트, 마스킹된 화면 녹화, 브라우저·기기, 유입 경로)·보관 기간을, 5번 자동 수집 장치에 localStorage 방문자 식별자와 거부 방법을 추가한다. 팀 규칙(일반 7일, 중요 30일 전)에 따라 서비스 공지를 게시한다.
4. 중단 시 원격 Replay off + ENABLED=false 재배포한다. 신규 수집 중단과 이미 저장된 데이터 삭제는 별도로 확인한다.

환경변수는 `FE/.env.example` 참고. 웹 프로젝트 token은 공개 수집용이며 Personal API key는 절대로 FE에 넣지 않는다. 처리방침 게시와 공지는 이번 코드 작업에서 수행하지 않는다.

## 광고 차단과 CloudFront 검토

1차는 공식 수집 호스트를 사용한다. 차단 확장 프로그램이 있으면 이벤트와 녹화가 모두 비어 있을 수 있다. Person에 기록이 없다는 이유만으로 미방문으로 단정하지 않는다. 차단기 사용/미사용 QA와 동등한 동의 조건의 테스트 트래픽으로 영향부터 확인한다.

필요하면 CloudFront의 별도 수집 경로를 US ingestion/asset origin으로 프록시한다. POST·OPTIONS, query 전달, 캐시 비활성(수집/flags), 압축/본문 크기, upstream Host/TLS, SDK asset 경로, CORS와 CSP를 검증해야 한다. API 인증 쿠키·Authorization은 upstream에 전달하지 않고 CDN access log에도 쿼리/개인정보를 남기지 않는다. 별도 IaC Issue로 구현하며 장애 시 제품 요청과 분리한다. 프록시도 광고 차단을 완전히 없애지 못하고 명시적 수집 거부를 우회하는 수단으로 사용하지 않는다. [공식 프록시 문서](https://posthog.com/docs/advanced/proxy)

## 대시보드와 QA

- People에서 `bibbidi:user:{id}` 검색 → 세션별 Events → Recordings. 세션 기준으로 소셜 시작/약관/계정 선택/완료, 일정 폼/제출/성공을 각각 분석한다.
- 세션의 마지막 화면·행동과 실패 사유를 확인한다. 최소 30분 비활성 방문만 이탈 후보로 보고 종료 시각·떠난 이유를 단정하지 않는다. 긴 OAuth 왕복은 세션이 나뉠 수 있으므로 회원 전환 퍼널과 방문 퍼널을 구분한다.
- 자동 검증: 비활성 초기화, SDK 오류 격리, 온보딩 페이지뷰, 임시 회원 미식별, 계정 변경/reset, URL/속성 마스킹, 콜백 실패 분류, 명시적 실패 이벤트.
- 실제 개발 프로젝트에서 **Discard client IP data** 설정이 켜져 있고 수신 데이터에 IP가 저장되지 않는지 확인한다.
- 실제 개발 프로젝트 QA: 같은 탭 게스트→약관→new/legacy→최종 Person 병합, 새로고침/다른 탭/탈퇴, Safari/모바일, 차단기, StrictMode 중복, 일정 저장 후 목록 조회 실패.
- 비밀 테스트 문자열을 입력·저장하고 Network payload와 실제 녹화에서 제목/메모/닉네임/비밀번호/code/state/referrer/DOM 속성에 남지 않는지 확인한다. 자동 테스트만으로 실제 수신·리플레이를 검증했다고 판단하지 않는다.

## 구현 책임과 변경 범위

기존 analytics 계층은 SDK 설정·정제·식별·장애 격리를 맡고, 앱 tracker는 인증/경로 전환 순서를 조정한다. 각 feature는 실제 사용자 행동과 API 결과에서 고정 이벤트를 만든다. PostHog 자체 서버·DB/outbox·새 범용 이벤트 버스는 추가하지 않는다. SDK는 현재 의존성으로 대체할 수 없는 리플레이 기능에 필요하다.

여러 인증 기능에 계측을 넣어 권장 파일 수를 초과하지만 하나의 사용자 여정과 개인정보 경계를 함께 검증해야 하므로 Issue 하나에서 구현한다. 리뷰는 (1) SDK/마스킹/식별, (2) 행동 이벤트/운영 문서 순으로 볼 수 있다. 별도 커밋·푸시는 요청받기 전 수행하지 않는다.
