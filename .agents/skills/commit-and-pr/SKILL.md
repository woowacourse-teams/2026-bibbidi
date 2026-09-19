---
name: commit-and-pr
description: Development Logger가 있는 저장소에서 커밋하기 전에 바꾼 내용을 개발자에게 설명해 확인받고, PR을 만들기 전에 PR에 올릴 내용을 개발자와 대화로 정한다. 커밋하거나 PR을 만들 때 사용하고, 코드 설명만 요청받았을 때는 사용하지 않는다.
---

# 커밋과 PR 전에 개발자와 확인하기

- 질문은 grill-me와 같은 기준을 따른다.
  - 한 번에 하나만 묻고, 답을 받은 뒤 다음으로 넘어간다.
  - 왜 확인이 필요한지, 선택지마다 무엇이 달라지는지, 추천과 이유를 쉬운 말로 쓴다.
  - 코드나 도구 이름을 쓰면 무슨 뜻인지 한 줄로 풀어 쓴다.
- Hook 안내에 나온 session ID를 `<session-id>` 자리에 넣는다.

## 작업 기록이 저장소에 나오는 시점

- 작업 중 기록은 저장소 밖(`.git/development-logger/pending/`)에 쌓인다. 그래서 작업하는 동안 `git status`에 `.devlog`가 나타나지 않는다.
- `commit confirm`을 기록하는 순간 그때까지의 기록이 `.devlog/<issue>/`로 나온다. 코드와 **같은 커밋**에 담는다. 작업 기록만 따로 커밋하지 않는다.
- PR을 만들고 나면 아직 내보내지 않은 기록은 버린다. PR 직전에 기록을 맞추려고 커밋을 더 만들지 않는다.

## 커밋 전

1. 무엇을, 왜, 어느 파일에서 바꿨는지 쉬운 말로 설명한다.
   - 파일마다 한두 줄로 쓴다.
   - 설계에서 정한 내용과 다르게 만든 부분이 있으면 먼저 말한다.
2. 설명을 기록한다.
   - `node --experimental-strip-types packages/development-logger/src/cli.ts commit explain --session <session-id> --text "<설명>"`
3. 개발자에게 이대로 커밋해도 되는지 묻고 답을 기다린다.
4. 개발자가 확인하면 기록한다.
   - `node --experimental-strip-types packages/development-logger/src/cli.ts commit confirm --session <session-id>`
   - 이때 작업 기록이 `.devlog/<issue>/`로 나온다.
   - 설명한 뒤 코드가 바뀌었다면 1번부터 다시 한다.
5. 코드와 `.devlog/<issue>/`를 함께 커밋한다.

## PR 전

1. PR에 올릴 내용을 개발자와 하나씩 정한다.
   - 변경 요약: 리뷰어가 먼저 알아야 할 변경을 결론부터 제안하고 확인받는다.
   - 리뷰받고 싶은 부분: 개발자가 특히 봐 줬으면 하는 곳을 묻는다.
   - 리뷰 요청마다 중요도를 붙인다.
     - `[REQUIRED]`: 합치기 전에 꼭 확인해야 하는 것
     - `[CAUTION]`: 위험이 있을 수 있어 확인이 필요한 것
     - `[ADVICE]`: 가벼운 개선 의견을 받고 싶은 것
2. 정한 내용을 기록한다. 요약과 리뷰 요청이 여러 개면 옵션을 여러 번 쓴다.
   - `node --experimental-strip-types packages/development-logger/src/cli.ts pr plan --session <session-id> --summary "<변경 요약>" --review "[REQUIRED] <리뷰 요청>"`
3. `gh pr create`로 PR을 만든다.
   - GitHub MCP 같은 다른 도구로는 만들지 않는다. PR 본문, 라벨, 작업 기록 확인을 거치지 않기 때문이다.
   - PR 본문의 "최종 변경 사항"과 "리뷰 요청"은 2번에서 기록한 내용으로 채워진다.
   - 커밋하지 않은 변경이 있으면 막힌다. 먼저 커밋을 끝낸다.
