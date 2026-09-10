# 참고할 실제 코드

기준 시점은 release-be의 f0f14ede387fe2fee51fd1033b39a0432d5acfb4다.
링크는 현재 브랜치의 파일을 가리킨다. 코드가 바뀌면 예시도 갱신한다.
작성자 이름이나 파일 전체를 품질 보증으로 사용하지 않고 아래 책임과 흐름만 참고한다.

| 기준 | 참고 위치 | 읽을 부분 |
| --- | --- | --- |
| 실행 순서 | [AppointmentService](../../BE/src/main/java/com/bibbidi/wedding/appointment/service/AppointmentService.java) | update: 조회 → 소유권 확인 → 도메인 변경 → 저장 → 충돌 조회 → 결과 |
| 규칙을 가진 객체 | [Appointment](../../BE/src/main/java/com/bibbidi/wedding/appointment/domain/Appointment.java) | conflictsWith: 확정 여부와 순간 일정·시간 겹침 판단 |
| 소유권과 항목 책임 | [Checklist](../../BE/src/main/java/com/bibbidi/wedding/checklist/domain/Checklist.java), [ChecklistItem](../../BE/src/main/java/com/bibbidi/wedding/checklist/domain/ChecklistItem.java) | changeItemTitle은 소유권·항목 확인, changeTitle은 제목 변경 가능 여부 판단 |
| 서비스의 조정 | [ChecklistService](../../BE/src/main/java/com/bibbidi/wedding/checklist/service/ChecklistService.java) | changeItemTitle은 조회 → 도메인 동작 → 저장 → 결과 |
| 완료 원인의 표현 | [Appointment](../../BE/src/main/java/com/bibbidi/wedding/appointment/domain/Appointment.java) | completeByChecklistItem과 changeCompletion의 완료 원인 구분 |
| 경계 조건 검증 | [AppointmentTest](../../BE/src/test/java/com/bibbidi/wedding/appointment/domain/AppointmentTest.java) | 일정 충돌의 경계와 순간 일정 사례 |
| 실패 시 정합성 | [완료 연동 통합 테스트](../../BE/src/test/java/com/bibbidi/wedding/checklist/service/ChecklistItemCompletionTransactionIntegrationTest.java) | 연동 변경 실패 시 롤백 검증 |

## 기준을 그대로 복제하지 않는 예

ChecklistService의 getChecklistItems는 실제로 제목·ID 정렬도 수행한다.
이름만으로 정렬을 예상하기 어려우므로 새 코드에서는 정렬 의미를 드러내는 이름을 검토한다.
기존 메서드라는 이유로 같은 이름을 권장하거나, 하네스 도입을 이유로 관련 없는 코드를 일괄 수정하지 않는다.
