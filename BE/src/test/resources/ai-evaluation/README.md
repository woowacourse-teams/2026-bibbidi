# AI 추천 평가 데이터

Issue #427의 현재 평가 범위는 사용자 상황에 맞는 결혼 준비 **카탈로그 항목 추천**이다. 상태 조회, 일정 조회, 체크리스트 변경, 업체 검색은 이 시나리오의 대상이 아니다.

- `scenarios/scenario01.json`~`scenario55.json`: 시나리오별 대화 입력과 답변 기준. 11개 지표에 각각 10개씩 연결한다.
- `metrics/*.json`: AWS Bedrock 지표 이름을 바탕으로 작성한 비비디 채점 기준. 점수는 초기에는 기록 전용이다.
- `prompt/BibbidiEvaluator.st`: 지표 설정과 시나리오 입력을 조합하는 평가 프롬프트 템플릿이다.
- `schema/judge-result.json`: 로컬 Codex·Claude CLI judge의 구조화된 결과 형식이다.
- `evaluation-user.sql`: 사용자 900001과 빈 체크리스트를 만든다. 이전 대화와 사용자 상황은 각 시나리오의 `chatMemory`와 질문으로 제공한다.
- `fixedTestUser.sql`: 이전 시나리오의 사용자 fixture이며 현재 평가에서는 사용하지 않는다.

## 재생 기준

1. 운영과 같은 `AiChatService.chat()` → 사전 조회 → 챗메모리 → 구조화된 스트리밍 응답 경로로 실행한다. 별도 도구 콜백이나 평가 전용 시스템 프롬프트를 만들지 않는다.
2. 테스트 카탈로그는 저장소의 `database/mysql/load_catalog.sql`과 일치시킨다. `referenceAnswer`에서 언급하는 항목명은 이 카탈로그에 존재한다.
3. 시나리오마다 새 대화 ID로 `chatMemory`를 순서대로 넣고 `userMessage`를 전달한다. 완료·실패·시간 초과 뒤에는 해당 대화의 메시지와 준비 정보 메모리를 정리한다.
4. `delta`를 합친 자연어 답변을 채점하고, `component`의 검증된 추천 ID를 보고서에 기록한다. `done` 없이 끝나거나 답변이 없으면 실행 오류로 처리한다.
5. `referenceAnswer`는 추천 이유와 제약을 판단할 기준이다. `expectedRefusal`이 `partial`인 경우 확인 불가능하거나 부적절한 요청 부분만 거부하고 가능한 카탈로그 추천은 이어간다.

도구 호출 기대값은 현재 서비스에서 도구 호출을 제거한 #435에 맞춰 삭제했다. 기존 55개 질문·이전 대화·답변 기준·지표 배정은 유지한다.

모델 답변(`modelResponse`)과 실제 전달한 준비 정보(`providedContext`)는 실행 시 수집한다. `providedContext`는 모델 호출 때 사용한 챗메모리의 카탈로그·체크리스트·추천 후보 스냅샷이다. 실제 모델 호출 프롬프트도 별도로 기록한다. 시나리오에는 서비스 응답 DTO나 가짜 조회 결과를 넣지 않는다.

지표 평가 프롬프트는 모든 지표에서 `role` → `task` → `rubric`·`scale` → `requiredInputs`에 지정한 입력 순서로 구성한다. 파일마다 같은 순서를 반복해 적지 않는다. 점수는 초기에는 보고서에 기록만 하며 합격 기준으로 사용하지 않는다.

`referenceAnswer`는 채점 참고 기준이며 챗봇이 실제로 조회한 데이터가 아니다. 실제 제공 맥락에는 `providedContext`만 넣는다. `Refusal` 점수는 거부 범위만 뜻하고 적절성은 시나리오의 `expectedRefusal`과 별도로 비교한다.

## 로컬 judge

`codex login`으로 ChatGPT 구독 계정에 로그인한 뒤 `CodexCliBibbidiJudge`를 모델 ID, 추론 수준, 시간 제한으로 생성한다. 이 구현은 `codex exec`의 저장된 로그인을 재사용하고, 읽기 전용·임시 실행에서 JSON 스키마로 결과를 받는다. 점수는 `EvaluationResponse`에 기록하지만 합격 기준이 없으므로 `isPass()`를 품질 합격으로 해석하지 않는다. 평가 불가는 `UnscorableException`으로 점수와 구분한다. 실제 CLI 실행은 로컬 통합 평가에서만 수행한다.

`ClaudeCliBibbidiJudge`는 Claude Code CLI의 로그인과 `--json-schema` 구조화 출력을 사용한다. Windows에서는 JSON 스키마 인수의 따옴표를 CLI에 맞게 전달한다.

## 통합 평가 실행

`BibbidiEvaluationIntegrationTest`는 실제 `AiChatService`와 별도 `BibbidiJudge`를 주입받는다. 생성 모델은 평가 전용 `BeanPostProcessor`로 감싸 기존 `ChatClient`의 모델 옵션·시스템 프롬프트·JSON 스키마를 유지하며 스트리밍 요청과 응답을 기록한다. 전체 시나리오의 모든 지정 메트릭을 평가한다. 모델과 판독 방식은 `application-evaluator.yaml` 또는 환경 변수에서 변경한다. `test`, `evaluator` 프로필을 순서대로 활성화해 공통 테스트 설정 위에 전용 H2 DB 설정을 적용한다. `application-test.yaml`을 import하면 가져온 공통 DB 설정이 평가 DB를 덮으므로 프로필 순서를 사용한다. 일반 `test` 작업에서는 외부 모델 평가를 제외하고 수동 작업에서만 실행한다. 컴파일은 일반 빌드에서도 수행한다.

```powershell
.\gradlew.bat aiEvaluationTest
```

실행 결과는 `build/reports/ai-evaluation/result.json`에 상세 JSON으로, `build/reports/ai-evaluation/summary.md`에 시나리오와 지표의 완료·오류·평가 불가 건수 요약으로 저장한다.

`BIBBIDI_EVALUATION_GENERATION_MODEL`은 Bedrock 생성 모델 ID다. `BIBBIDI_EVALUATION_JUDGE_PROVIDER`는 `codex` 또는 `claude`, `BIBBIDI_EVALUATION_JUDGE_MODEL`은 판독 모델 ID다. Codex 추론 수준은 `BIBBIDI_EVALUATION_JUDGE_REASONING_EFFORT`로 설정한다. 실행 시 전체 시나리오의 지정 메트릭을 평가한다.

실행 결과는 `build/reports/ai-evaluation/result.json`에 기록한다. 실행 시각과 판독 모델의 추론 설정을 함께 저장한다. 시나리오마다 생성 모델의 호출별 질문(시스템·대화·사용자·도구 응답), 구조화된 원문 응답과 토큰 사용량을 기록하고, 생성 호출 전체의 토큰 합계와 최종 자연어 답변·추천 ID·실제로 제공한 준비 정보도 담는다. 각 메트릭에는 판독 모델에 전달한 전체 프롬프트, 구조화된 답변, 점수·이유와 토큰 사용량을 담는다. 토큰 사용량을 제공하지 않는 필드는 `null`로 기록한다. 생성·응답 형식 검증·판독 중 오류가 나거나 평가 불가가 발생하면 해당 시나리오의 상태, 실패 단계와 이유, 그때까지 수집한 결과를 JSON에 기록하고 테스트 실패도 유지한다. 현재 점수에는 품질 합격 기준을 적용하지 않으므로 `qualityPassDetermined`는 `false`다.

지표 이름과 평가 대상은 [AWS 지표](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-metrics.html), 역할·작업·척도·입력 순서는 [Judge 프롬프트](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-type-judge-prompt.html)와 [커스텀 지표 프롬프트 형식](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-custom-metrics-prompt-formats.html)을 참고했다. 실제 채점 문구와 점수 정의는 비비디의 카탈로그 추천 사례에 맞게 작성했다. [커스텀 지표 작업](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-custom-metrics-create-job.html)의 데이터셋·평가 모델·결과 분리 개념도 참고한다.

## 외부 모델 없이 회귀 검증

```sh
./BE/gradlew -p BE test --tests '*EvaluationChatRunnerTest' --tests '*RecordingChatModelTest'
```

현재 채팅 설정·서비스·응답 파서를 사용하고 모델과 채점기만 대역으로 바꾼다. 55개 시나리오와 110개 지표 조합, 시나리오별 대화 격리, 자연어 답변과 실제 입력 전달, 실패 보고서, 스트리밍 누적 토큰의 중복 집계 방지를 검증한다. 대역 실행 보고서는 테스트 임시 디렉터리에 저장하며 실제 모델의 품질 평가 결과로 취급하지 않는다. 스트리밍 사용량은 마지막으로 제공된 누적 값을 기록하며 제공되지 않은 값은 `null`로 남긴다.
