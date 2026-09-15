---
name: bibbidi-conventions
description: Bibbidi 저장소에서 코드·테스트·Git·PR 또는 로그 처리 방식을 변경할 때 docs/convention의 팀 규칙을 작업 범위에 맞게 적용한다. 단순 설명이나 저장소 밖의 작업에는 사용하지 않는다.
---

# Bibbidi Conventions

- 구현 전에 작업 범위에 해당하는 `docs/convention` 문서를 끝까지 읽는다.
  - 문서 내용을 Skill에 옮겨 적지 않고, 저장소 문서를 기준으로 삼는다.
  - 사용자 요구사항이나 Issue와 부딪히면 추측하지 말고 구현 전에 질문한다.
  - 문서에 없는 규칙은 새로 만들지 않고 주변 코드를 따른다.

## 문서 선택

- 모든 코드·Git·PR 작업에서는 [`docs/convention/git-convention.md`](../../../docs/convention/git-convention.md)를 읽는다.
- `BE` 코드를 변경할 때는 [`docs/convention/code-convention.md`](../../../docs/convention/code-convention.md)를 읽는다.
- 오류 응답, 예외, 보안 로그 또는 민감정보 처리를 변경할 때는 [`docs/convention/error-handling.md`](../../../docs/convention/error-handling.md)를 읽는다.
- `BE` 테스트를 추가·변경하거나 검증 범위를 결정할 때는 [`docs/convention/test-strategy.md`](../../../docs/convention/test-strategy.md)를 읽는다.
- `FE`와 `APP`에는 코드·테스트 규칙 문서가 없으므로 `git-convention.md`와 각 패키지의 기존 코드·스크립트를 기준으로 삼는다.
- 저장소 공통 도구가 로그를 기록한다면 `error-handling.md`의 로그 보안 규칙을 적용한다.

## 적용

- 작업과 관계없는 파일을 한꺼번에 고치지 않는다.
- 규칙을 지키기 어려우면 이유, 다른 방법, 영향을 먼저 설명하고 사용자 결정을 기다린다.
- 저장소에 정의된 테스트 명령을 먼저 쓰고, 바꾼 코드와 가장 가까운 테스트부터 실행한다.
- 끝나면 참고한 문서, 확인한 완료 조건, 일부러 규칙과 다르게 한 부분을 결론부터 짧게 정리한다.
