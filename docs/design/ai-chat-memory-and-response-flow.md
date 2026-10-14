# 챗메모리와 추천 응답 처리 구조

이 문서는 현재 구현의 파일 역할과 요청 흐름을 설명한다. 모델을 호출하는 도구는 등록하지 않고, 서버가 매 챗 요청에서 최신 준비 정보를 조회해 모델에 전달한다. 모델은 답변과 추천 항목 ID를 한 번의 스트리밍 응답으로 반환한다.

## 추가한 코드와 그 이유

| 코드 | 추가한 이유 | 역할 |
| --- | --- | --- |
| [`BibbidiChatMemory`](../../BE/src/main/java/com/bibbidi/wedding/chat/infra/ai/BibbidiChatMemory.java) | 대화가 쌓여도 사용자 준비 정보가 메시지 한도에서 밀려나지 않게 한다. | Spring AI의 `ChatMemory`를 구현하고, 고정 정보 2개와 최근 대화 18개를 함께 반환한다. |
| [`ChecklistSnapshot`](../../BE/src/main/java/com/bibbidi/wedding/chat/service/dto/ChecklistSnapshot.java) | 체크리스트가 없는 상태를 조회 장애와 구분해서 모델에 전달한다. | `exists`와 체크리스트 항목을 담는다. 조회 장애는 빈 체크리스트로 변환하지 않고 전파한다. |
| [`ChecklistItemSnapshot`](../../BE/src/main/java/com/bibbidi/wedding/chat/service/dto/ChecklistItemSnapshot.java) | 준비 상태와 연결 일정을 모델이 읽을 형태로 변환한다. | 항목 ID, 원본 카탈로그 ID, 제목, 진행 상태, 일정을 담는다. 사용자 정의 항목의 카탈로그 ID는 null일 수 있다. |
| [`ChatAnswer`](../../BE/src/main/java/com/bibbidi/wedding/chat/service/dto/ChatAnswer.java) | 답변과 추천 카드를 한 번의 모델 응답으로 받는다. | 모델 출력의 `answer`와 `recommendedItemIds`를 담는다. |
| [`ChatAnswerStream`](../../BE/src/main/java/com/bibbidi/wedding/chat/infra/ai/ChatAnswerStream.java) | JSON 응답이 아직 완성되지 않았어도 답변 텍스트를 바로 전송한다. | 스트리밍 중 `answer`를 추출하고, 완료 시 JSON과 추천 ID 형식을 검증한다. |
| [`AiChatConfig.ANSWER_SCHEMA`](../../BE/src/main/java/com/bibbidi/wedding/chat/config/AiChatConfig.java) | 모델에 출력 필드와 타입을 지정한다. | `answer` 문자열과 `recommendedItemIds` 정수 배열을 필수로 지정하며 추가 필드를 허용하지 않는다. |
| `AiChatConfig.strictJsonFormatRequestParameters()` | GPT 모델의 구조화된 출력에 strict 옵션을 전달한다. | 모델 ID에 `openai.gpt-`가 있으면 중첩 JSON 옵션 `text.format.strict=true`를 추가한다. |
| [`ConversationKey.fromMemoryKey()`](../../BE/src/main/java/com/bibbidi/wedding/chat/service/ConversationKey.java) | `ChatMemory.get(String)`에서 준비 정보를 조회할 사용자 ID를 복원한다. | 인증 사용자 ID와 대화 UUID로 만든 내부 키를 읽는다. |
| `BibbidiChatMemory.userInfoKey()` | 대화 기록과 고정 정보를 같은 저장소에서 구분해 보관한다. | `user-info:<userId>`에 고정 메시지 2개를 저장한다. 접두사는 저장 키의 용도를 구분하는 구현 선택이다. |
| [`ChecklistService.findMyChecklistIfPresent()`](../../BE/src/main/java/com/bibbidi/wedding/checklist/service/ChecklistService.java) | 체크리스트가 없는 정상 상태를 예외 없이 읽는다. | 읽기 전용 트랜잭션에서 `Optional`을 반환한다. 실제 조회 오류는 그대로 전파한다. |
| [`RequestAttributeSecurityContextRepository`](../../BE/src/main/java/com/bibbidi/wedding/auth/config/SecurityConfig.java) 연결 | SSE의 Servlet 비동기 재처리에서 최초 인증 결과를 복원한다. | 인증 결과를 같은 요청의 속성에 저장한다. 서버 세션을 만들거나 다른 요청으로 인증을 넘기지 않는다. |

카탈로그 항목은 기존 `CatalogItemDetailSnapshot`, 일정은 기존 `ChecklistAppointmentResult`를 재사용한다. 공개 요청·응답에는 기존 `ChatRequest`와 `ChatResponse`를 사용한다. 챗메모리 전용 조회·저장 서비스는 별도로 두지 않는다.

Spring AI 2.0.1의 Bedrock 요청 파라미터는 `Map<String, String>`으로 선언되어 있으나 변환기에 중첩 JSON 값을 전달할 수 있어 strict 옵션 메서드에서 타입 변환을 제한적으로 사용한다. 실제 Bedrock 어댑터가 만드는 요청을 대역으로 검증한다.

## ChatMemory를 교체한 방식

`AiChatService`는 Spring AI의 `ChatMemory` 인터페이스에만 의존한다. `AiChatConfig`가 해당 빈으로 `BibbidiChatMemory`를 등록한다. 호출부는 `get()`, `add()`, `clear()`를 사용한다.

`BibbidiChatMemory` 내부에서 Spring AI의 `MessageWindowChatMemory`를 대화 큐로 그대로 사용한다. 설정한 총 메시지 한도에서 고정 정보 2개를 뺀 값을 대화 큐 한도로 지정한다. 기본 한도 20개에서는 최근 문답 9쌍, 즉 18개 메시지가 남는다. 설정의 최솟값 4는 고정 정보 2개와 문답 한 쌍을 보관하기 위한 값이다.

| 저장 내용 | 키 | 저장 방식 |
| --- | --- | --- |
| 대화 기록 최대 18개 | `<인증 userId>:<conversation UUID>` | 완료된 질문과 답변을 추가하고 오래된 메시지를 제거한다. 다른 사용자와 다른 대화의 기록은 분리한다. |
| 사용자 준비 정보와 카탈로그 2개 | `user-info:<인증 userId>` | 매 `get()`에서 DB를 읽고 `saveAll()`로 기존 두 메시지를 덮어쓴다. |

고정 메시지 첫 번째에는 체크리스트, 항목의 상태·일정, 추천 가능한 카탈로그 ID가 들어간다. 두 번째에는 전체 카탈로그가 들어간다. 이미 체크리스트에 추가한 원본 카탈로그 ID는 추천 후보에서 제외한다.

고정 메시지는 사용자 데이터인 `UserMessage`로 전달하며, 시스템 규칙은 별도의 시스템 메시지로 전달한다. 첫 번째 고정 메시지의 메타데이터에는 서버가 계산한 추천 후보 ID 집합도 넣어 출력 ID 검증에 사용한다.

`get()`은 저장된 고정 정보 값을 재사용하지 않고 매번 조회한다. 조회 결과를 고정 메시지로 보관한 다음, 해당 요청에서 만든 고정 메시지와 대화 기록을 합쳐 반환한다. 준비 정보·카탈로그를 수정하면 다음 챗 요청의 조회 결과에 반영된다. 고정 메시지를 저장할 때 대화 큐에 추가하지 않으므로 요청마다 사용자 정보가 대화 기록으로 누적되지 않는다.

`add()`는 대화 큐에만 문답을 저장하고, `clear()`는 지정한 대화 기록만 지운다. 메모리 저장소는 `InMemoryChatMemoryRepository`이므로 서버 재시작 시 초기화되며 서버 인스턴스끼리 공유하지 않는다.

## 요청부터 완료까지

1. 사용자가 `POST /api/ai/chat`으로 `message`와 선택적인 `conversationId`를 전송한다. Controller는 인증한 사용자 ID를 사용하며 요청 입력을 검증한다.
2. `SseStreamManager`가 연결별 제한 시간과 가상 스레드 작업을 준비한다. `AiChatService`가 대화 UUID를 만들거나 재사용하고 `conversation`을 전송한다. 같은 사용자·대화의 동시 응답은 하나만 허용한다.
3. `chatMemory.get()`이 기존 카탈로그·체크리스트 서비스를 통해 최신 정보를 읽고 고정 메시지 두 개를 덮어쓴다. 각 조회 서비스가 읽기 전용 트랜잭션을 관리한다. 조회 장애가 발생하면 모델을 호출하지 않는다.
4. `AiChatService`가 시스템 프롬프트, 대화 기록과 고정 정보, 이번 질문을 모델에 전달한다. 저장 메시지 한도 20개에 이번 질문과 시스템 프롬프트는 포함되지 않는다. DB 조회 트랜잭션은 모델 응답을 기다리는 동안 유지하지 않는다.
5. 모델의 JSON 조각을 `ChatAnswerStream.append()`에 전달한다. 새로 읽은 답변 텍스트가 있으면 `delta`로 즉시 전송한다.
6. 스트림이 끝나면 `finish()`로 전체 JSON을 검증한다. 추천 ID는 전달했던 추천 후보 집합에 속하는지 확인하고 중복을 제거한다. 추천이 있으면 `ChecklistService.filterRecommendableCatalogItemIds()`로 현재 DB의 존재 여부와 이미 추가한 항목을 다시 확인하고 `component`를 전송한다.
7. `done` 전송이 성공하면 완료 콜백에서 사용자 질문과 자연어 답변을 `chatMemory.add()`로 저장한다. 중간 오류, 잘못된 모델 출력, 취소, 시간 초과로 완료되지 않은 문답은 저장하지 않는다.

앱에서 모델 스트리밍을 요청하는 횟수는 정상 챗 요청당 한 번이다. 추천 ID 검증을 위한 DB 조회는 별도로 발생할 수 있다.

## ChatAnswerStream이 필요한 이유

모델은 다음 JSON 구조로 응답한다.

```json
{
  "answer": "웨딩홀 후보를 먼저 정해보세요.",
  "recommendedItemIds": [1, 2]
}
```

`ANSWER_SCHEMA`와 시스템 프롬프트가 이 출력 구조를 지정한다. `ChatAnswerStream`은 모델이 보낸 JSON을 읽는 클래스다. 전체 JSON이 끝날 때까지 기다렸다가 DTO로 변환하면 답변 문자열이 생성되는 동안 텍스트를 전송할 수 없다. 그래서 `append()`는 아직 닫히지 않은 `answer` 문자열에서 새 텍스트를 추출한다.

`ReadTarget`은 현재 JSON 구조, 필드 이름, 답변 문자열, 다른 문자열 중 무엇을 읽는지 나타낸다. 문자열 이스케이프와 유니코드 조각을 처리하며, 이모지의 UTF-16 문자 쌍이 나뉘면 뒤쪽 문자가 도착할 때까지 전송을 보류한다. 답변 안의 중괄호·따옴표와 추천 ID가 답변 텍스트로 혼동되지 않게 한다.

`finish()`는 Jackson의 중복 필드 검출을 켜고 전체 JSON을 읽는다. 두 필드의 존재·타입, 추가 필드와 후속 JSON 유무, 빈 답변, 추출해 전송한 답변과 완성된 답변의 일치, 추천 ID의 양의 정수·Long 범위를 확인한다. 실패하면 추천 카드와 정상 완료를 전송하지 않는다.

공개 SSE 데이터에는 기존 필드 이름을 유지한다.

| 전송명 | 데이터 |
| --- | --- |
| `conversation` | `{"conversationId":"대화 UUID"}` |
| `delta` | `{"text":"새 답변 텍스트"}` |
| `component` | `{"catalogItemIds":[1,2]}` |
| `done` | `{"conversationId":"대화 UUID"}` |
| `failure` | `{"message":"공개 실패 메시지"}` |

추천 카드는 모델 응답 전체를 검증한 뒤, `done` 전에 전달한다. 추천이 없으면 `component`를 전송하지 않는다. 모델이 쓰는 내부 필드 `recommendedItemIds`와 공개 카드 응답의 필드 `catalogItemIds`를 구분한다.

## 코드 읽는 순서와 검증

`AiChatController.chat()` → `AiChatService.chat()`와 `streamAnswer()` → `BibbidiChatMemory.get()`와 `refreshFixedMessages()` → `ChatAnswerStream.append()`와 `finish()` → `ChatSseHandler.complete()` 순서로 읽으면 요청 흐름을 따라갈 수 있다. `AiChatConfig`에서 시스템 프롬프트, 출력 스키마, 메모리 빈 등록을 확인한다.

테스트는 매 요청 최신 정보 반영, 사용자·대화 기록 분리, 고정 정보 유지와 큐 교체, 읽기 전용 조회와 모델 호출의 트랜잭션 분리, 한 글자씩 들어오는 JSON과 이모지, 잘못된 출력, SSE 종료·취소, 인증 재처리를 검증한다. Bedrock 요청과 모델 응답은 대역으로 검증하며, 실제 서버의 Bedrock 모델 응답과 nginx까지 포함한 전체 흐름은 별도 확인 대상이다.

저장소 루트에서 검증한다.

```sh
BE/gradlew test -p BE
BE/gradlew build -p BE
```
