# Bibbidi AI 리뷰와 앱 브랜치 동기화

`main`과 같은 공통 자동화를 `dev-app`에 연결한다. 앱 환경 설정과 APP CI는 변경하지 않는다.

## 실행 흐름

- `ai-review-pre.yml`: `dev-be`, `dev-fe`, `dev-app` 대상 PR에서 Issue 문맥, 리뷰 대상 경로와 민감정보를 검사한다. 실제 모델 API 키는 전달하지 않는다.
- `ai-review-job.yml`: 사전 검사 workflow가 성공하면 기본 브랜치의 리뷰 코드를 실행한다. PR 코드는 실행하지 않으며 검사를 다시 수행한다. 모델 리뷰는 PR당 최초 한 번만 수행한다.
- `pr-lifecycle.yml`: 병합된 같은 저장소의 작업 PR에서 종료 대상으로 연결된 Issue와 작업 브랜치를 정리한다. `Refs`만 있는 Issue는 종료하지 않는다. 장기 브랜치, 다른 열린 PR이 사용하는 브랜치와 병합 당시 SHA에서 바뀐 브랜치는 보존한다.

AI 리뷰 구현은 `common/`, `pre/`, `job/`에 두며 GitHub API 호출은 `../github/`를 사용한다.
브랜치 정리 구현은 `../pr-lifecycle/`에 있다. 기존 `ai-code-review.yml`은 제거했다.

## 검증

Node.js 24와 pnpm 11에서 실행한다.

```bash
pnpm --dir .github/ai-review install --frozen-lockfile
pnpm exec tsc -p .github/ai-review/tsconfig.json
pnpm exec tsc -p .github/pr-lifecycle/tsconfig.json
node --experimental-strip-types --test .github/ai-review/pre/review-precheck.test.ts .github/pr-lifecycle/pr-lifecycle.test.ts
actionlint .github/workflows/ai-review-pre.yml .github/workflows/ai-review-job.yml .github/workflows/pr-lifecycle.yml
```

테스트는 가짜 GitHub API로 판단과 보존 조건을 검증하며 실제 Issue나 브랜치를 변경하지 않는다.
실제 Actions 이벤트는 PR 생성·병합 이후 확인해야 한다. 리뷰 봇 자체를 변경하는 이번 동기화 PR은
기존 보호 정책에 따라 자동 AI 리뷰 대신 사람이 확인한다.

수동 정리 workflow의 `apply` 기본값은 `false`다. 기본값으로 실행하면 과거 PR 정리 대상을 조회만 한다.
