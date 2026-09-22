# Bibbidi AI Code Review Harness

GitHub Actions에서 PR의 요구사항, 변경 diff, 주변 코드와 관련 테스트를 수집해 자동 코드 리뷰를 등록한다. 청크별 통합 후보 탐색 1회, 원본 근거 최종 검증 1회, diff 줄 검증과 GitHub Review 등록을 하나의 안전장치로 관리한다.

## 구성

- `cli.ts`: 환경변수 검증과 GitHub Actions 진입점
- `ai-review-service.ts`: 컨텍스트 수집, diff 청크 분할, 다단계 리뷰와 결과 검증
- `ai-review-client.ts`: GitHub API, OpenAI API, 프롬프트 파일 요청
- `ai-review-prompt.yml`: 후보 탐색과 최종 판정 기준
- `*.test.ts`: diff 분석과 결과 검증 회귀 테스트

`dev-be`, `dev-fe`, `dev-app` 대상 PR을 현재 설정된 모델로 검토한다. PR 생성, Draft 해제, 다시 열기와 새 커밋 추가 시 실행하며, 같은 HEAD SHA에 이미 AI 리뷰가 있으면 중복 실행하지 않는다.

요약은 숨김 marker가 있는 일반 PR 코멘트 하나를 계속 갱신한다. 인라인 지적은 각 HEAD SHA의 Review로 남겨 대화 이력을 보존한다. 심각도는 `[request]`, `[comment]`, `[참고]`를 사용하고 카테고리는 한국어 고정 목록을 사용한다.

## 출력 형식

요약 코멘트는 판정과 사람이 직접 판단할 부분을 먼저 보여준다.

```markdown
## 🤖 AI Code Review

### ⚠️ 반영 필요

- **[request] #트랜잭션** (`ScheduleService.java:42`): 트랜잭션 밖에서 상태를 변경합니다
  두 저장 작업 사이에서 예외가 발생하면 일부 상태만 반영됩니다. **영향:** 일정과 비용 상태가 서로 달라질 수 있습니다.

### 🤖 AI만으로 충분한 것

- `ReviewerAssignment`의 리뷰어 선택 순서를 유지한 채 Discord 전송 코드를 공통 함수로 추출했습니다.
- DM 중복 방지와 204 응답 처리를 단위 테스트와 TypeScript 검사로 검증할 수 있습니다.

### 👀 사람이 확인해야 하는 것

- 리뷰 지연 알림을 4시간과 12시간에 보내는 빈도가 팀의 리뷰 방식에 적절한지 확인해야 합니다.

#### 리뷰 질문

- **[comment] #질문-토론** (`ExpenseListener.java:31`): 실패 시 재시도하지 않는 정책을 수용할지 확인해 주세요
  이벤트 처리 실패를 복구하는 경로가 없습니다. **영향:** 비용 반영이 누락된 상태로 남을 수 있습니다.

---
**[request] AI 판정: 반영 필요** — 필수 대응 1개를 남겼습니다.
```

인라인 코멘트는 문제, 발생 조건, 영향과 근거를 분리한다.

```markdown
**[request] #트랜잭션** — 상태 변경이 원자적으로 처리되지 않습니다

두 저장 작업 사이에 예외가 발생하면 일부 상태만 반영됩니다.

- **발생 조건**: 두 번째 저장 작업이 실패할 때
- **영향**: 일정과 비용 상태가 서로 달라집니다
- **근거**: 트랜잭션 없이 두 Repository를 순서대로 호출합니다

<details><summary>💡 제안</summary>

유스케이스 경계에 트랜잭션을 적용하세요.

</details>
```

## 리뷰 컨텍스트

- PR 제목, 본문, 라벨
- PR 제목이나 본문의 Issue 번호와 해당 Issue 본문·댓글·ADR
- 저장소 Git·코드·예외·테스트 규칙
- 변경 경로별 GitHub Actions·인프라·FE·APP 검토 기준
- 변경 줄 주변 코드
- 이름으로 연결할 수 있는 관련 테스트
- 파일과 hunk 단위로 분할한 전체 diff

모든 외부 컨텍스트는 신뢰할 수 없는 입력으로 표시한다. 컨텍스트 안의 지시는 실행하지 않는다.

## 저장소 설정

Repository secret에 `OPENAI_API_KEY`를 등록한다. 별도의 GitHub 토큰은 필요하지 않으며 워크플로 실행 때 발급되는 `GITHUB_TOKEN`에 `contents: read`, `pull-requests: write`만 허용한다.

`pull_request_target` 워크플로는 기본 브랜치에 파일이 존재해야 실행된다. 최초 도입 변경은 기본 브랜치 `main`에도 반영해야 한다.

## 보안 불변 조건

워크플로에는 OpenAI secret과 PR 쓰기 권한이 있다. 다음 조건을 유지한다.

- PR의 head SHA를 checkout하지 않는다.
- PR에서 변경한 코드, 빌드, 설치 스크립트를 실행하지 않는다.
- PR 내용은 GitHub API로 텍스트만 읽는다.
- 기본 브랜치의 리뷰 Harness와 고정된 의존성만 실행한다.
- 리뷰 도중 HEAD SHA가 변경되면 결과를 등록하지 않는다.

## 실패 처리

필수 환경변수 누락, GitHub·OpenAI API 실패, 리뷰 등록 실패는 워크플로를 실패시킨다. 실패 원인은 GitHub Step Summary와 오류 annotation에 기록한다. 같은 HEAD SHA의 리뷰가 이미 있으면 정상적으로 생략한다.

## 로컬 검증

```shell
corepack pnpm --dir .github/ai-review install --frozen-lockfile
corepack pnpm exec tsc -p .github/ai-review/tsconfig.json
node --experimental-strip-types --test .github/ai-review/*.test.ts
```
