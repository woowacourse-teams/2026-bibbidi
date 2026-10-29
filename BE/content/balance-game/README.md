# 선택지 이미지가 있는 문항 JSON

`questions-with-images.json`은 Q1~Q10의 각 A/B 선택지에 `imageUrl`을 포함합니다. ID는 기존 API와 동일한 문자열이며 주소는 S3의 WebP 객체를 직접 가리킵니다. JAR에 기본 콘텐츠로 포함하지 않고 기존 외부 JSON 설정으로 읽습니다.

## 적용 순서

1. 이 파일을 기존 JSON과 다른 키 `bibbidi/be/balance-game/question/bibbidi-balance-game-questions-with-images.json`으로 S3에 업로드합니다. 기존 `bibbidi-balance-game-questions.json`은 유지합니다.
2. 이 변경이 포함된 백엔드를 배포할 때 아래 환경변수를 함께 적용합니다.
3. 재시작 후 `GET /api/balance-game/questions`에서 10문항과 선택지별 `imageUrl` 20개를 확인합니다. 프론트엔드는 이 주소를 이미지에 연결해야 합니다.

```dotenv
BIBBIDI_BALANCE_GAME_QUESTIONS_LOCATION=https://techcourse-project-2026.s3.ap-northeast-2.amazonaws.com/bibbidi/be/balance-game/question/bibbidi-balance-game-questions-with-images.json
```

구버전 백엔드는 `imageUrl`을 모르는 필드로 처리하므로 기존 JSON을 먼저 덮어쓰거나 env만 먼저 전환하면 읽기에 실패합니다. 새 백엔드도 `imageUrl`이 없는 기존 JSON은 읽지 못하므로 코드와 env를 함께 전환합니다. `BIBBIDI_BALANCE_GAME_TYPES_LOCATION`은 기존 값을 유지합니다. 롤백할 때도 이전 코드와 기존 JSON 주소를 함께 복원합니다.
