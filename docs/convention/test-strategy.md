# Bibbidi 테스트 전략

이 문서는 Bibbidi 백엔드의 테스트 코드 작성 기준과 테스트 범위를 판단하는 기준을 다룬다.

## 테스트 코드 작성 기준

- 각 계층이 책임지는 규칙을 해당 계층에서 테스트한다.
- 같은 규칙을 여러 계층에서 중복 검증하지 않는다.
- 가능한 경우 큰 통합 테스트보다 책임과 가까운 작은 테스트에서 먼저 검증한다.
- DB 테스트는 H2를 사용한다.
  - JPA Mapping
  - Repository Query
  - QueryDSL
  - Paging / Sorting / Filtering
  - Unique Constraint
- 외부 Provider는 실제 호출하지 않는다.
- 외부 연동이 추가되면 Adapter 경계와 오류 변환만 테스트한다.
- 모듈 경계와 API 문서도 테스트 대상으로 본다.
- 통합 테스트의 픽스처는 SQL 스크립트로 두고 `@Sql`로 적재한다. 데이터를 심으려고 테스트 클래스에 Repository를 주입하지 않는다.
- REST Docs를 남기는 통합 테스트에는 데이터를 둔다. 응답이 비면 문서 예시가 빈 배열이 되고 중첩 필드를 전부 `optional()`로 돌려야 한다.
- 상위 계층 테스트가 이미 실제 흐름으로 덮는 변환·매핑은 따로 테스트하지 않는다.

## 계층별 테스트 대상

- **Domain**: 도메인 상태 전이와 불변식을 검증한다.
- **Service**: 객체 간 협력과 부수 효과를 검증하고, 실패 시 저장이 발생하지 않는지 확인한다.
- **Persistence**: JPA Mapping, Query, Paging, Filtering, DB Constraint를 검증한다.
- **Controller**: HTTP 요청·응답 계약과 Validation을 검증하고 오류 응답 계약도 확인한다.
- **통합 테스트**: 여러 계층이 연결된 핵심 흐름과 Security 등 횡단 관심사를 검증한다.

## 현재 테스트 범위의 한계

현재 테스트는 운영 환경 전체를 재현하지 않는다. 사용자 증가, 트래픽 증가, 다중 인스턴스 운영 등으로 현재 테스트 환경에서 검증하지 못하는 영역의 위험도가 높아지면 별도의 검증 환경과 테스트를 추가한다.

현재 직접 검증하지 않는 영역:

- 실제 MySQL의 Query Plan, Lock, 동시성
- 다중 Server Instance 간 Cache 공유와 동시 처리
- nginx부터 외부 Provider까지 연결된 운영 환경 전체 E2E
