# AI 추천 평가 데이터

Issue #427의 현재 평가 범위는 사용자 상황에 맞는 결혼 준비 **카탈로그 항목 추천**이다. 상태 조회, 일정 조회, 체크리스트 변경, 업체 검색은 이 시나리오의 대상이 아니다.

- `scenarios/scenario01.json`~`scenario55.json`: 시나리오별 대화 입력, 기대 도구 호출, 답변 기준. 11개 지표에 각각 10개씩 연결한다.
- `metrics/*.json`: AWS Bedrock 지표 이름을 바탕으로 작성한 비비디 채점 기준. 점수는 초기에는 기록 전용이다.
- `prompt/BibbidiEvaluator.st`: 지표 설정과 시나리오 입력을 조합하는 평가 프롬프트 템플릿이다.
- `schema/judge-result.json`: 로컬 Codex·Claude CLI judge의 구조화된 결과 형식이다.
- `fixedTestUser.sql`: 이전 시나리오의 사용자 fixture다. 현재 55개 추천 시나리오는 개인 체크리스트를 조회하지 않으므로 이 파일을 사용하지 않는다.

## 재생 기준

1. 모델에는 `findCatalog` 도구만 제공한다. 현재 서비스 설정에는 개인 체크리스트 도구도 있으므로 실제 평가 실행기를 만들 때 이 차이를 반영해야 한다.
2. 테스트 카탈로그는 저장소의 `database/mysql/load_catalog.sql`과 일치시킨다. `referenceAnswer`에서 언급하는 항목명은 이 카탈로그에 존재한다.
3. `chatMemory`를 배열 순서대로 이전 user/assistant 메시지로 전달하고 `userMessage`를 현재 메시지로 전달한다. 사용자 상황과 이미 끝낸 일은 이 대화에만 들어 있다.
4. `expectedToolCalls`는 `findCatalog` 호출을 확인하는 기준이다. 실제 도구가 반환한 카탈로그를 모델에 전달한다.
5. `referenceAnswer`는 추천 이유와 제약을 판단할 기준이다. `expectedRefusal`이 `partial`인 경우 확인 불가능하거나 부적절한 요청 부분만 거부하고 가능한 카탈로그 추천은 이어간다.

모델 답변(`modelResponse`)과 실제 도구 결과는 실행 시 수집한다. 시나리오에는 서비스 응답 DTO나 가짜 도구 응답을 넣지 않는다.

지표 평가 프롬프트는 모든 지표에서 `role` → `task` → `rubric`·`scale` → `requiredInputs`에 지정한 입력 순서로 구성한다. 파일마다 같은 순서를 반복해 적지 않는다. 점수는 초기에는 보고서에 기록만 하며 합격 기준으로 사용하지 않는다.

`referenceAnswer`는 채점 참고 기준이며 챗봇이 실제로 조회한 데이터가 아니다. 실제 조회 맥락에는 `observedToolResults`만 넣는다. `Refusal` 점수는 거부 범위만 뜻하고 적절성은 시나리오의 `expectedRefusal`과 별도로 비교한다.

## 로컬 judge

`codex login`으로 ChatGPT 구독 계정에 로그인한 뒤 `CodexCliBibbidiJudge`를 모델 ID, 추론 수준, 시간 제한으로 생성한다. 이 구현은 `codex exec`의 저장된 로그인을 재사용하고, 읽기 전용·임시 실행에서 JSON 스키마로 결과를 받는다. 점수는 `EvaluationResponse`에 기록하지만 합격 기준이 없으므로 `isPass()`를 품질 합격으로 해석하지 않는다. 평가 불가는 `UnscorableException`으로 점수와 구분한다. 실제 CLI 실행은 로컬 통합 평가에서만 수행한다.

`ClaudeCliBibbidiJudge`는 Claude Code CLI의 로그인과 `--json-schema` 구조화 출력을 사용한다. Windows에서는 JSON 스키마 인수의 따옴표를 CLI에 맞게 전달한다.

## 통합 평가 실행

`BibbidiEvaluationIntegrationTest`는 Spring AI `ChatModel`과 `BibbidiJudge`를 별도 객체로 주입받는다. 전체 시나리오의 모든 지정 메트릭을 기본으로 평가하며, `findCatalog`의 실제 호출 결과를 기록해 판독 프롬프트에 전달한다. 모델과 판독 방식은 `application-evaluator.yaml` 또는 환경 변수에서 변경한다. `evaluator` 프로필을 사용하며 일반 `test` 작업에서는 이 테스트를 제외하고 수동 작업에서만 실행한다.

```powershell
.\gradlew.bat aiEvaluationTest
```

`BIBBIDI_EVALUATION_GENERATION_MODEL`은 Bedrock 생성 모델 ID다. `BIBBIDI_EVALUATION_JUDGE_PROVIDER`는 `codex` 또는 `claude`, `BIBBIDI_EVALUATION_JUDGE_MODEL`은 판독 모델 ID다. Codex 추론 수준은 `BIBBIDI_EVALUATION_JUDGE_REASONING_EFFORT`로 설정한다. 실행 시 전체 시나리오의 지정 메트릭을 평가한다.

실행 결과는 `build/reports/ai-evaluation/result.json`에 기록한다. 시나리오마다 생성 모델의 호출별 질문(시스템·대화·사용자·도구 응답), 답변, 요청한 도구와 토큰 사용량을 기록하고, 생성 호출 전체의 토큰 합계와 최종 답변 및 실제 도구 호출·결과도 담는다. 각 메트릭에는 판독 모델에 전달한 전체 프롬프트, 구조화된 답변, 점수·이유와 토큰 사용량을 담는다. 토큰 사용량을 제공하지 않는 필드는 `null`로 기록한다. 실패한 시나리오는 Gradle 테스트 결과에 표시하며 JSON에는 완료된 시나리오만 기록한다. 현재 점수에는 품질 합격 기준을 적용하지 않으므로 `qualityPassDetermined`는 `false`다.

지표 이름과 평가 대상은 [AWS 지표](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-metrics.html), 역할·작업·척도·입력 순서는 [Judge 프롬프트](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-type-judge-prompt.html)와 [커스텀 지표 프롬프트 형식](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-custom-metrics-prompt-formats.html)을 참고했다. 실제 채점 문구와 점수 정의는 비비디의 카탈로그 추천 사례에 맞게 작성했다. [커스텀 지표 작업](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-custom-metrics-create-job.html)의 데이터셋·평가 모델·결과 분리 개념도 참고한다.
