---
name: grill-me
description: GitHub Issue 기반 구현 전에 요구사항과 설계를 결정 트리로 검증하고 합의된 결정·대안·근거·검증 방법을 정리한다. 새 개발 작업을 시작하거나 핵심 ADR을 다시 열 때 사용하며, 단순 질의나 이미 합의된 구현을 반복할 때는 사용하지 않는다.
---

# Grill Me

- 구현 전에 사용자와 설계의 모든 필수 분기를 합의한다.
  - 모호한 요구사항, 숨은 전제, 책임 위치, 대안, trade-off, 검증 방법을 드러낸다.
  - 구현 결과를 사후 정당화하기 위한 질문은 하지 않는다.

## 준비

- 질문 전에 직접 확인할 수 있는 사실을 조사한다.
  - GitHub Issue와 댓글을 읽는다.
  - 관련 코드, 프로젝트 규칙, 기존 검증 명령을 확인한다.
  - 기술적으로 검증 가능한 사실은 공식 문서나 공신력 있는 자료에서 확인한다.
- 사용자에게는 선택과 정책만 질문한다.
  - 코드나 문서에서 확인할 수 있는 사실을 사용자에게 묻지 않는다.
  - 조사 중인 사실에 의존하는 질문은 해당 사실이 확인될 때까지 보류한다.

## 진행

- 설계를 결정 트리로 관리한다.
  - 각 결정 아래에 그 결정이 확정되어야 답할 수 있는 후속 결정을 둔다.
  - 선행 결정이 끝난 질문들의 집합을 현재 라운드로 정의한다.
- 한 라운드에서는 현재 답할 수 있는 질문을 함께 제시한다.
  - 질문마다 번호, 선택이 필요한 이유, 현실적인 대안, 추천안과 추천 이유를 제공한다.
  - 개수를 채우기 위한 질문이나 이미 명확한 내용을 반복하는 질문은 제외한다.
  - 서로 의존하는 질문은 같은 라운드에 넣지 않는다.
- 사용자의 답변을 받은 뒤 결정 트리를 다시 계산한다.
  - 답변이 새로운 분기나 충돌을 만들면 다음 라운드에서 다룬다.
  - 사용자가 모른다고 답하면 추측하지 않고 조사, 작은 실험, prototype 중 적절한 방법을 제안한다.

라운드는 다음 형식을 따른다.

```markdown
- Q1. **질문 제목**
  - 질문: 결정해야 하는 내용
  - 대안: 선택 가능한 안과 핵심 trade-off
  - 추천: 추천하는 안과 이유

- Q2. **질문 제목**
  - 질문: 결정해야 하는 내용
  - 대안: 선택 가능한 안과 핵심 trade-off
  - 추천: 추천하는 안과 이유
```

## 기록 의미

- Development Logger가 활성화된 경우 Hook이 다음 의미로 대화를 기록하도록 한다.
  - 시작: `GRILL_ME_STARTED`
  - 질문: 질문마다 `GRILL_ME_QUESTION`
  - 답변: 답변마다 `GRILL_ME_ANSWER`
  - 결정: 합의된 결정마다 `GRILL_ME_DECISION`
  - 종료: `GRILL_ME_FINISHED`
- Skill 자체가 Hook을 우회해 `.devlog`를 직접 조작하지 않는다.
- Development Logger가 설치된 저장소에서는 공통 CLI로 의미 Event를 기록한다.
  - Hook Context가 제공한 session ID를 각 명령의 `<session-id>`에 사용한다.
  - 라운드 시작 전: `node packages/development-logger/src/cli.mjs grill start --session <session-id>`
  - 질문 제시 전 각 질문마다: `node packages/development-logger/src/cli.mjs grill question --session <session-id> --text "<question>"`
  - 사용자 답변으로 합의한 각 결정마다: `node packages/development-logger/src/cli.mjs grill decision --session <session-id> --text "<decision>"`
  - 종료 합의 전: `node packages/development-logger/src/cli.mjs grill finish --session <session-id>`
  - CLI가 실패하면 구현으로 넘어가지 않고 실패 원인과 복구 방법을 알린다.

## 종료 조건

- 다음 조건을 모두 충족할 때만 인터뷰 종료를 제안한다.
  - 구현 범위와 비범위가 명확하다.
  - 핵심 책임과 데이터 흐름이 명확하다.
  - 주요 대안과 trade-off가 비교됐다.
  - 실패·복구 정책과 호환성 조건이 명확하다.
  - 프로젝트에 맞는 검증 명령과 통과 기준이 정해졌다.
  - 외부 근거가 필요한 기술 결정과 Issue 합의로 충분한 제품 결정이 구분됐다.
- 결론을 두괄식·개조식으로 정리한다.
  - 결정
  - 이유
  - 대안과 trade-off
  - 근거
  - 검증
  - 미해결 사항
- 사용자에게 공유된 이해가 맞는지 확인한다.
  - 사용자가 명시적으로 확인하기 전에는 ADR 작성이나 구현으로 넘어가지 않는다.
