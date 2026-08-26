# 숫자형 오류 코드 예외 처리 개발 지침

## 목표

서버 로그의 내부 오류 정보와 클라이언트 공개 정보를 분리한다.

- 예외 `message`에는 문제 추적에 필요한 서버용 문맥을 담는다.
- 응답에는 사전에 정의한 안전하고 안정적인 정보만 담는다.
- 클라이언트는 숫자형 `errorCode`로 오류 종류를 식별한다.
- 내부 메시지·스택 트레이스·SQL·외부 API 원문을 응답에 노출하지 않는다.
- Spring의 `ResponseEntityExceptionHandler` 처리 경로를 유지한다.

## 오류 응답 계약

일반 오류 응답은 다음 두 필드만 사용한다.

```json
{
  "errorCode": 401,
  "message": "이미 사용 중인 닉네임입니다."
}
```

| 필드 | 형식 | 용도 |
| --- | --- | --- |
| `errorCode` | JSON number | 애플리케이션 오류 코드 |
| `message` | JSON string | 공개 고정 메시지 |

HTTP 상태는 응답 본문이 아니라 HTTP 응답 상태 코드로 전달한다. 응답에는 `status`, `type`, `title`, `detail`, `instance`를 포함하지 않는다.

## 오류 코드 규칙

- 오류 코드는 HTTP 상태 코드와 독립적인 3자리 숫자다.
- `1xx`: 요청·입력값 오류
- `2xx`: 인증·인가 오류
- `3xx`: 리소스 오류
- `4xx`: 비즈니스 오류
- `5xx`: HTTP 프로토콜 오류
- `9xx`: 서버 내부 오류
- enum 선언 순서나 `ordinal()`로 오류 코드를 생성하지 않는다.
- 오류 코드는 전체 애플리케이션에서 유일하며 의미를 변경·재사용하지 않는다.
- 신규 오류 코드·상태·공개 메시지는 사용자 확인 후 Notion 에러 문서 DB에 등록한다.

오류 코드·HTTP 상태·공개 메시지의 단일 관리 위치는 [Notion 에러 문서 DB](https://horn-file-5e3.notion.site/DB-3c7aec9466d680fca09cec5a82d5755c)다. 구현할 때는 반드시 이 문서를 기준으로 삼는다.

오류를 추가·변경·삭제할 때는 다음 순서를 따른다.

1. Notion 에러 문서 DB의 오류 코드·HTTP 상태·공개 메시지를 먼저 업데이트한다.
2. Notion에 등록된 내용과 일치하도록 `ClientError`와 `GlobalExceptionHandler`를 수정한다.
3. 오류 응답 테스트와 API 문서를 갱신한다.

저장소에는 별도의 오류 코드 목록을 두지 않는다.

## 검증 오류 확장 계약

검증 실패는 기본 두 필드에 `errors` 배열을 추가한다.

```json
{
  "errorCode": 101,
  "message": "요청 값이 올바르지 않습니다.",
  "errors": [
    {
      "field": "email",
      "message": "이메일 형식이 올바르지 않습니다."
    }
  ]
}
```

`errors[].field`는 요청 필드명이며 `errors[].message`는 공개 검증 메시지다. rejected value나 내부 예외 메시지는 포함하지 않는다.

## 애플리케이션 예외

```java
public class BusinessException extends RuntimeException {

    private final ClientError clientError;

    public BusinessException(ClientError clientError, String logMessage) {
        super(logMessage);
        this.clientError = clientError;
    }

    public ClientError clientError() {
        return clientError;
    }
}
```

도메인·서비스 계층은 HTTP 상태나 `ErrorResponse`를 직접 사용하지 않고, 해당 `ClientError`와 로그용 메시지를 가진 예외를 생성한다.

## 글로벌 예외 처리

`GlobalExceptionHandler`는 다음을 분리한다.

1. SLF4J에는 예외의 내부 메시지와 요청 문맥을 기록한다.
2. `ErrorResponse`에는 `ClientError`의 오류 코드와 공개 메시지만 넣는다.

- 예상 가능한 4xx는 `WARN`으로 기록한다.
- 예상하지 못한 5xx는 원인 예외와 스택 트레이스를 포함해 `ERROR`로 기록한다.
- `handleExceptionInternal`에서 Spring의 상태 코드·헤더 처리 경로를 유지한다.
- HTTP 상태 매핑은 `GlobalExceptionHandler`가 담당한다.
- Spring MVC 예외도 적절한 `ClientError`로 변환한다.

## 로그 보안

로그에도 비밀번호, 인증 토큰·세션 ID, 카드 번호, 주민등록번호, 외부 API의 민감한 원문을 기록하지 않는다. 필요한 식별자는 마스킹하거나 추적 ID를 사용한다.

## 금지 사항

- `ErrorResponse.message`에 `ex.getMessage()`를 넣지 않는다.
- 응답에 스택 트레이스나 내부 예외 클래스를 넣지 않는다.
- 상태 코드 매핑을 여러 핸들러에 중복해서 하드코딩하지 않는다.
- 사용자 확인 없이 오류 코드·상태·공개 메시지를 추가·변경하지 않는다.
- Notion 에러 문서 DB에 등록하지 않고 오류 코드를 추가·변경하지 않는다.
- Controller에서 예외를 잡아 오류 응답을 직접 만들지 않는다.

## 테스트 조건

- 실제 HTTP 상태가 `GlobalExceptionHandler`의 매핑과 같다.
- 응답 `errorCode`가 `ClientError.errorCode()`와 같다.
- 응답 `message`가 `ClientError.message()`와 같다.
- `errorCode`가 JSON number로 직렬화된다.
- 응답에 `status`가 포함되지 않는다.
- 내부 로그 메시지가 응답에 포함되지 않는다.
- 응답에 ProblemDetail 필드가 포함되지 않는다.
- 4xx WARN, 5xx ERROR 로깅을 검증한다.
- Spring MVC 예외도 동일한 계약을 따른다.
- 오류 코드가 중복되지 않는다.
