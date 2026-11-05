# FE 오류 추적 운영 절차

Issue: [#347](https://github.com/woowacourse-teams/2026-bibbidi/issues/347).

## 범위와 우선순위

- Sentry Cloud US의 조직 `bibbidi-ku`와 `bibbidi-fe` 프로젝트를 사용한다. Business 무료 체험판이 끝나도 Developer 무료 플랜으로 운영할 수 있는 범위만 채택한다. 로컬 개발 서버에서는 수집하지 않는다. 테스트 배포는 `development`로 수집하고, 운영 배포는 처리방침 개정 전까지 끈다.
- 브라우저의 처리되지 않은 예외와 React 렌더 오류를 자동 수집한다. 인증 동기화, 일정 조회·생성·관리의 예상하지 못한 실패는 명시적으로 보고한다. 입력 검증, 예상한 권한 거부·세션 만료, 요청 취소는 보고하지 않는다.
- `fatal`: 앱 진입·렌더 또는 인증 동기화가 불가능함. `error`: 일정 생성·관리 등 핵심 동작 실패. `warning`: 일정 조회나 생성 후 목록 새로고침 실패처럼 복구 가능한 오류.
- 오류 이벤트와 제한된 breadcrumb만 수집한다. 성능 추적·세션 리플레이·콘솔 로그·네트워크 본문은 켜지 않는다.

## 프로젝트와 배포 설정

1. 팀 소유 계정으로 생성된 US 리전 조직 `bibbidi-ku`의 React 브라우저 프로젝트 `bibbidi-fe`를 사용한다. 가입 직후 Business 체험판 14일이 자동 적용됐고 결제 수단은 등록되지 않았다(2026-10-01 확인). 유료 플랜으로 전환하거나 결제 수단을 등록하지 않는다. 체험판 전용 기능에 의존하지 않고 만료 후 Developer 무료 플랜 상태와 한도를 확인한다. 무료 플랜의 멤버 제한으로 Sentry 이슈 확인은 계정 접근 권한이 있는 담당자가 맡는다.
2. 테스트 FE CodeBuild 프로젝트 `bibbidi-fe-development-build`에 `BIBBIDI_SENTRY_ENABLED=true`, `BIBBIDI_SENTRY_DSN`(프로젝트의 공개 클라이언트 DSN), `SENTRY_ORG`(조직 slug), `SENTRY_PROJECT`(프로젝트 slug), `BIBBIDI_APP_ENV=development`를 설정한다. `SENTRY_AUTH_TOKEN`은 소스맵 업로드용 `org:ci` 조직 토큰으로 만든다. 지속 운영 시에는 AWS Systems Manager Parameter Store의 Standard `SecureString` `/bibbidi/fe/sentry/auth-token`에 저장하고 기본 `aws/ssm` 키를 사용한다. CodeBuild 환경 변수 `SENTRY_AUTH_TOKEN`의 유형을 `Parameter`로, 값은 이 파라미터 이름으로 설정한다. CodeBuild 서비스 역할에는 이 파라미터에 대한 `ssm:GetParameters`만 허용한다. 토큰을 코드·로그·채팅·브라우저 번들에 넣지 않는다.
3. CodeBuild의 `CODEBUILD_RESOLVED_SOURCE_VERSION`을 릴리스 이름으로 쓴다. 수동 빌드에서는 `BIBBIDI_APP_VERSION`을 명시한다. 테스트 배포는 Sentry 설정 누락·소스맵 업로드 실패 시 중단된다. 업로드한 `.map`은 빌드 결과물에서 삭제하고, 배포 단계에서도 `.map`이 남아 있으면 S3 동기화를 중단한다.
4. 운영은 [개인정보 처리방침 Issue #191](https://github.com/woowacourse-teams/2026-bibbidi/issues/191)에 Sentry 수탁자, US 이전, 수집 항목·보관 기간·문의 절차를 반영하고 고지한 뒤 같은 변수를 운영 CodeBuild에 넣어 활성화한다. 그 전에는 `BIBBIDI_SENTRY_ENABLED`를 설정하지 않거나 `false`로 둔다. 설정 변경은 재빌드·재배포해야 적용된다.

공개 DSN은 FE 번들에 포함되지만 업로드 토큰은 포함되지 않는다. 운영·테스트는 하나의 Sentry 프로젝트를 쓰고 `environment`로 분리한다. 무료 할당량과 보관 기간은 조직 화면에서 확인하고, 초과 시 이벤트 누락 가능성을 운영 지표에 명시한다.

### 임시 테스트용 토큰 예외

2026-10-01 테스트 담당자의 Parameter Store 접근 권한이 없어, 사용자가 임시 검증에 한해 CodeBuild의 `SENTRY_AUTH_TOKEN`을 `Plaintext` 환경 변수로 설정하기로 결정했다. 이 값은 CodeBuild 콘솔·CLI에서 볼 수 있으므로 장기 운영에 사용하지 않는다. 검증 직후 권한 있는 팀원이 `SecureString`을 만들고 CodeBuild 참조를 전환하거나, Sentry를 끄고 테스트 토큰을 폐기한다. 토큰 폐기 전에 CodeBuild 변수만 삭제하면 다음 테스트 빌드는 설정 검사에서 실패한다. 임시 토큰 값은 문서·Issue·PR·채팅·빌드 로그에 기록하지 않는다.

## 알림 상태

2026-10-01 조직 화면에서 공식 Discord 연동은 Team 이상 유료 플랜으로 표시된다. 무료 운영을 선택했으므로 Discord 연동과 자동 알림은 이번 범위에서 보류한다. 프로젝트 생성 시 자동으로 만들어진 `Send a notification for high priority issues` 이메일 알림도 비활성화했다. 담당자가 Sentry Issues에서 `environment`와 `level`로 이슈를 확인한다. 따라서 팀원에게 오류 발생을 자동 통보하는 상태는 아니며, 알림이 필요해지면 비용·지연 허용 범위를 먼저 다시 결정해야 한다.

## 개인정보 경계

전송 전에 허용 목록으로 이벤트를 재구성한다. 사용자 정보는 인증 완료 후 숫자 회원 ID만, 화면은 알려진 고정 경로만, 사용자 동작은 코드에 정의한 고정 이름만 남긴다. 오류 원문 메시지, 요청 URL·쿼리, 응답, 입력값, 이메일, 이름, 임의 태그와 SDK 자동 breadcrumb는 버린다. 스택의 코드 위치와 릴리스 정보는 디버깅을 위해 남긴다. 로그아웃과 세션 만료 때 회원 ID를 즉시 지운다.

새 화면·오류 보고 지점을 추가하면 고정 경로/동작 허용 목록과 개인정보 테스트를 함께 검토한다. SDK·브라우저 변경 뒤에는 실제 Sentry 수신 이벤트와 네트워크 payload에서 비밀 테스트 문자열이 없는지 확인한다. 예외 수집은 디버깅 단서이지 사용자 행동 전체의 기록이 아니다.

조직 설정에서 IP 주소 저장 방지, Enhanced Privacy를 켜고 익명 Issue 공유를 껐다. `bibbidi-fe` 프로젝트의 Data Scrubber와 기본 스크러버는 이미 켜져 있으며, 공개 JS 소스 가져오기는 끄고 TLS 검증은 켰다. 수신 이벤트 QA에서 이 설정도 다시 확인한다.

## 검증과 디버깅

1. 테스트 배포에서 의도적으로 고유한 `Error`를 발생시킨다. Sentry `Issues`에서 `environment=development`와 해당 릴리스를 필터링해 수신을 확인한다. 원문에만 있는 비밀 문자열이 이벤트에 없고, 스택이 원본 TS/TSX 파일·줄 번호로 복원되는지 확인한다.
2. 비로그인·로그인·로그아웃과 공개 경로/인증 콜백 이동을 시험한다. 숫자 회원 ID는 로그인 후에만, 콜백 URL의 `code`·`state`와 일정 제목·메모는 어디에도 없어야 한다. 예상한 401·입력 오류·요청 취소는 새 이슈를 만들지 않아야 한다.
3. 제보가 오면 Sentry 이슈에서 환경, 릴리스, 첫 발생/최근 발생, 스택의 파일·줄, 화면 경로, 고정 동작 breadcrumb와 `failure_kind`를 본다. 같은 버전의 테스트 서버에서 동일 화면·동작으로 재현하고, 원인을 고친 뒤 재배포하여 재발 여부를 확인한다. Sentry에 없는 경우 광고 차단, 네트워크 차단, 무료 한도 초과 가능성을 먼저 확인한다.

긴급 중단은 해당 배포 환경의 `BIBBIDI_SENTRY_ENABLED=false`로 재배포한다. 이미 수집된 이벤트 삭제는 별도 작업이다.
