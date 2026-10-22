# 서비스 없이 모델을 평가하는 로컬 실행

`aiLocalEvaluationTest`는 Spring 애플리케이션과 DB를 띄우지 않고 준비한 입력으로 모델을 직접 호출합니다. 기존 서비스 통합 평가인 `aiEvaluationTest`와 별도로 실행합니다. 일반 `test`와 `build`에서는 외부 모델을 호출하지 않습니다.

Codex와 Claude CLI를 설치하고 각각 로그인한 뒤 실행합니다. 답변 모델은 `codex/<모델>` 또는 `claude/<모델>`로 지정하고, 채점 모델은 별도로 선택합니다.

```bash
cd BE
BIBBIDI_LOCAL_EVALUATION_INPUT=src/test/resources/ai-evaluation/local/example.json \
BIBBIDI_EVALUATION_GENERATION_MODEL=codex/gpt-6.1-sol \
BIBBIDI_EVALUATION_JUDGE_PROVIDER=claude \
BIBBIDI_EVALUATION_JUDGE_MODEL=claude-opus-5-5 \
./gradlew aiLocalEvaluationTest
```

예시 파일은 실행 방법을 보여 주는 작은 평가용 자료입니다. 실제 비교에는 별도 JSON 파일에 다음 내용을 준비합니다.

- `systemPrompt`: 답변 모델의 시스템 안내문
- `providedContext`: 카탈로그·체크리스트 등 모델에 제공할 자료의 문자열 배열
- `scenarios`: 기존 평가 시나리오 형식의 질문·이전 대화·채점 지표·참고 답변

자료는 서비스나 DB에서 조회하지 않습니다. 시스템 안내문과 준비 정보를 답변 모델에 전달하고, 같은 내용을 채점 근거에도 포함합니다. 지표 정의와 채점 프롬프트는 기존 `ai-evaluation/metrics`, `ai-evaluation/prompt`를 그대로 사용합니다.

모델을 비교할 때는 입력 파일·지표·채점 모델을 고정하고 답변 모델만 바꿉니다. #575·#577처럼 답변 모델과 채점 모델을 함께 바꾸면 점수 차이의 원인을 답변 모델 하나로 좁힐 수 없습니다.

| 환경 변수 | 값 |
| --- | --- |
| `BIBBIDI_LOCAL_EVALUATION_INPUT` | 필수. 입력 JSON 파일 경로 |
| `BIBBIDI_EVALUATION_GENERATION_MODEL` | 필수. `codex/<모델>` 또는 `claude/<모델>` |
| `BIBBIDI_EVALUATION_GENERATION_REASONING_EFFORT` | Codex 답변의 reasoning effort. 기본 `medium` |
| `BIBBIDI_EVALUATION_GENERATION_TIMEOUT` | 답변 제한 시간. 기본 `PT2M` |
| `BIBBIDI_EVALUATION_JUDGE_PROVIDER` | `codex` 또는 `claude`. 기본 `codex` |
| `BIBBIDI_EVALUATION_JUDGE_MODEL` | 채점 모델. 기본 `gpt-6-sol` |
| `BIBBIDI_EVALUATION_JUDGE_REASONING_EFFORT` | Codex 채점의 reasoning effort. 기본 `low` |
| `BIBBIDI_EVALUATION_JUDGE_TIMEOUT` | 채점 제한 시간. 기본 `PT2M` |
| `BIBBIDI_LOCAL_EVALUATION_REPORT_DIR` | 결과 상위 폴더. 기본 `build/reports/ai-local-evaluation` |

매번 시각별 하위 폴더에 `input.json`, `metrics.json`, `configuration.json`, `result.json`, `summary.md`를 저장합니다. `configuration.json`에는 모델·reasoning effort·제한 시간을 저장합니다. 결과에는 모델 조합, 실제 프롬프트·답변·추천 ID, 점수·채점 이유·토큰 사용량을 남깁니다. 실패한 단계와 지표도 기록하며, 시간 초과는 `failure.timedOut`으로 구분합니다. 시나리오 하나가 실패해도 나머지를 실행하고 최종 보고서를 저장합니다.

코드 검증은 외부 모델 대신 실행 파일 대역을 사용합니다.

```bash
cd BE
./gradlew test --tests '*CliChatModelTest' --tests '*LocalEvaluationRunnerTest'
./gradlew aiLocalEvaluationTest --test-dry-run
```
