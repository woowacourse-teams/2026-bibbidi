# Bibbidi AI Code Review Harness

GitHub Actions를 실행 환경으로 사용하는 AI 코드 리뷰 Harness다. PR 컨텍스트 수집, 4단계 모델 호출, 결과 검증, GitHub Review 등록을 하나의 안전장치로 관리한다.

## 구조

- `cli.ts`: GitHub Actions가 실행하는 진입점
- `ai-review-service.ts`: 리뷰 흐름과 diff 검증
- `ai-review-client.ts`: GitHub API, OpenAI API, 프롬프트 파일 요청
- `ai-review-prompt.yml`: AI 리뷰 프롬프트

`release-be`, `release-fe`, `release-app`을 대상으로 생성되거나 Draft에서 전환된 PR을 `gpt-5.6-luna`로 검토한다.

## 저장소 설정

Repository secret에 `OPENAI_API_KEY`를 등록한다. 별도의 GitHub 토큰은 필요하지 않으며, 워크플로 실행 때 발급되는 `GITHUB_TOKEN`에 `contents: read`, `pull-requests: write`만 허용한다.

`pull_request_target` 워크플로는 기본 브랜치에 파일이 존재해야 실행된다. 최초 도입 변경은 기본 브랜치 `main`에도 반영해야 한다.

## 실행 시점

- `opened`: Draft가 아닌 PR이 생성됐을 때 실행한다.
- `ready_for_review`: Draft PR이 리뷰 가능한 상태로 바뀌었을 때 실행한다.

커밋 추가(`synchronize`)와 PR 재오픈(`reopened`) 때는 자동으로 다시 실행하지 않는다.

## 보안 불변식

이 워크플로에는 OpenAI secret과 PR 쓰기 권한이 있다. PR의 head SHA를 checkout하거나, PR에서 변경한 코드·빌드·설치 스크립트를 실행하지 않는다. 리뷰 대상 diff는 GitHub API로만 읽는다.

## 로컬 검증

```shell
corepack pnpm --dir .github/ai-review install --frozen-lockfile
node --experimental-strip-types --test .github/ai-review/*.test.ts
```
