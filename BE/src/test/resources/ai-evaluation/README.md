# AI 추천 평가 데이터

Issue #427의 현재 평가 범위는 사용자 상황에 맞는 결혼 준비 **카탈로그 항목 추천**이다. 상태 조회, 일정 조회, 체크리스트 변경, 업체 검색은 이 시나리오의 대상이 아니다.

- `scenarios/scenario01.json`~`scenario55.json`: 시나리오별 대화 입력, 기대 도구 호출, 답변 기준. 11개 지표에 각각 10개씩 연결한다.
- `metrics/*.json`: AWS Bedrock 지표 이름을 바탕으로 작성한 비비디 채점 기준. 점수는 초기에는 기록 전용이다.
- `fixedTestUser.sql`: 이전 시나리오의 사용자 fixture다. 현재 55개 추천 시나리오는 개인 체크리스트를 조회하지 않으므로 이 파일을 사용하지 않는다.

## 재생 기준

1. 모델에는 `findCatalog` 도구만 제공한다. 현재 서비스 설정에는 개인 체크리스트 도구도 있으므로 실제 평가 실행기를 만들 때 이 차이를 반영해야 한다.
2. 테스트 카탈로그는 저장소의 `database/mysql/load_catalog.sql`과 일치시킨다. `referenceAnswer`에서 언급하는 항목명은 이 카탈로그에 존재한다.
3. `chatMemory`를 배열 순서대로 이전 user/assistant 메시지로 전달하고 `userMessage`를 현재 메시지로 전달한다. 사용자 상황과 이미 끝낸 일은 이 대화에만 들어 있다.
4. `expectedToolCalls`는 `findCatalog` 호출을 확인하는 기준이다. 실제 도구가 반환한 카탈로그를 모델에 전달한다.
5. `referenceAnswer`는 추천 이유와 제약을 판단할 기준이다. `expectedRefusal`이 `partial`인 경우 확인 불가능하거나 부적절한 요청 부분만 거부하고 가능한 카탈로그 추천은 이어간다.

모델 답변(`modelResponse`)과 실제 도구 결과는 실행 시 수집한다. 시나리오에는 서비스 응답 DTO나 가짜 도구 응답을 넣지 않는다.

지표 평가 프롬프트는 역할, 작업, 채점 기준, 입력 순서로 구성한다. 각 지표 파일의 `task`, `rubric`, `scale`, `requiredInputs`, `promptOrder`를 사용한다.

참고 자료: [AWS 지표](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-metrics.html), [Judge 프롬프트](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-type-judge-prompt.html), [커스텀 지표 프롬프트 형식](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-custom-metrics-prompt-formats.html), [커스텀 지표 작업](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-custom-metrics-create-job.html).
