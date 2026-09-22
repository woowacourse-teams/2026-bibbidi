# Git Convention

## 기본 전략

기본 브랜치 전략은 `Trunk 전략`을 사용한다.

문서화는 `REST Docs + Swagger` 전략을 사용한다. 짧은 배포 주기와 프론트엔드의 즉각적인 문서 확인을 지원하기 위해 기능 단위를 작게 유지하고 빠른 피드백을 우선한다.

## Trunk 구조

```text
BE  Dev = dev-be       / Release = release-be
FE  Dev = dev-fe       / Release = release-fe
APP Dev = dev-app      / Release = release-app
```

```text
dev-be  ──→ release-be  ──┐
dev-fe  ──→ release-fe  ──┼──→ main
dev-app ──→ release-app ──┘
```

| 분야 | 개발 브랜치 | 개발 배포 환경 | Release | 운영 배포 기준 |
| --- | --- | --- | --- | --- |
| BE | `dev-be` | BE 테스트 환경 | `release-be` | BE AWS 운영 환경 |
| FE | `dev-fe` | FE 테스트 환경 | `release-fe` | FE AWS 운영 환경 |
| APP | `dev-app` | - | `release-app` | App Store 배포 기준선 |

### `main`, `release-*`, `dev-*`

- `main`은 배포 브랜치로 사용하지 않는다.
- 테스트 환경 CD는 `dev-be`와 `dev-fe`, 운영 환경 CD는 각 분야의 `release-*`를 기준으로 수행한다.
- `release-*`는 각 분야의 배포 기준 브랜치이며 항상 배포 가능한 상태를 유지한다.
- `dev-*`는 작업 브랜치의 기준점이자 PR 병합 대상인 개발 통합 브랜치다.
- `dev-be`와 `dev-fe`는 각각 BE·FE 테스트 환경에 CD로 연결한다.
- 검증을 마친 `dev-*`를 같은 분야의 `release-*`에 반영한다.
- `hotfix`와 `docs` 작업은 `release-*`에 바로 반영할 수 있다.
- `chore` 작업은 팀 합의 후에만 `release-*`에 바로 반영한다.

## 브랜치 이름

허용되는 브랜치 접두사는 다음과 같다.

- `feature`: 사용자 기능 개발
- `fix`: 일반적인 버그 수정
- `hotfix`: 배포 후 운영 장애 대응
- `docs`: 문서 변경
- `chore`: 인프라 및 유지보수 작업

브랜치 식별자는 GitHub Issue ID를 사용한다.

```text
{prefix}/{issue-id}

예시: feature/201
```

## Issue와 PR Type Label

- 모든 Issue와 PR은 다음 `type:*` Label 중 정확히 하나를 사용한다.
  - `feature` Branch → `type: feature`
  - `fix` Branch → `type: fix`
  - `hotfix` Branch → `type: hotfix`
  - `chore` Branch → `type: chore`
  - `docs` Branch → `type: docs`
- Coding Agent가 Issue를 생성할 때 Type Label이 없거나 둘 이상이면 생성을 차단한다.
- Coding Agent가 PR을 생성할 때 Head Branch Prefix와 Issue의 Type Label이 다르면 생성을 차단한다.
- Coding Agent가 만드는 PR에는 Head Branch Prefix에 해당하는 Type Label을 자동으로 추가한다.
- GitHub UI에서 사람이 Issue나 PR을 만들 때는 Template 안내에 따라 Type Label을 직접 선택한다.
- Label 강제 Gate는 Coding Agent에만 적용하며 사람의 GitHub UI 작업을 GitHub Action으로 차단하지 않는다.

## 작은 Issue와 짧은 브랜치

- Issue 하나당 PR 하나를 만든다.
- 예상 리뷰 시간은 20분 이하로 유지한다.
- Issue 구현은 당일 구현을 목표로 한다.
- 핵심 변경 코드는 200줄 이하를 권장한다.
- 핵심 변경 파일은 5개 이하를 권장한다.
- 핵심 변경 코드 350줄 초과, 변경 파일 10개 초과, 리뷰 60분 초과, 구현 2일 이상은 작업 분할을 검토한다.
- 테스트 코드와 단순 변수명 변경은 변경량 판단에서 제외한다.

Issue는 기술 계층이 아니라 사용자 스토리를 기준으로 분리한다. 하나의 사용자 스토리가 BE·FE·APP 모두에 영향을 주면 분야별 Issue로 나눈다.

```text
User Story
├── #201 · BE
├── #202 · FE
└── #203 · APP
```

Controller 구현, Service 구현, Repository 구현처럼 기술 계층만 기준으로 Issue를 나누지 않는다.

## PR 및 병합

### 작업 흐름

```text
dev-be
    │
    ├── feature/201
    │        │
    │        └── PR → Squash Merge
    │
    └── feature/202
             │
             └── PR → Squash Merge
                         │
                         ▼
                       dev-be
                         │
                         └── PR → Merge Commit
                         ▼
                    release-be
                         │
                         ▼
                 AWS 운영 배포 환경
```

### PR 제목

- 작업 브랜치에서 `dev-*`로 제출하는 PR 제목에는 GitHub Issue ID를 포함한다.

```text
[#201] 할 일 완료 API 구현
```

- `release-*`에서 `main`으로 병합할 때는 BE·APP·FE 버전을 제목에 명시한다.

```text
BE v1.3.0 / APP v1.2.0 / FE v1.4.0
```

### 병합 방식

- 작업 브랜치 → `dev-*`: Squash Merge
- `dev-*` → `release-*`: Merge Commit
- `release-*` → `main`: Merge Commit
- Squash Merge가 완료된 작업 브랜치는 삭제한다.

```text
feature/201
  ├── commit A
  ├── commit B
  └── commit C
         │ Squash Merge
         ▼
dev-be
  └── [#201] 하나의 커밋
         │ Merge Commit
         ▼
release-be
         │ Merge Commit
         ▼
main
```

### 충돌 해결

- PR 병합 전 최신 대상 브랜치와의 충돌 여부를 확인한다.
- 충돌은 작업 브랜치에서 해결한다.
- 충돌 해결 후 CI를 다시 실행한다.

### `main` 반영

- AWS·Store 배포가 완료되고 해당 분야 상태가 안정화된 경우에만 `release-*`를 `main`에 반영한다.
- `release-* → main`은 Merge Commit을 사용한다.

## 배포 및 운영

- `dev-be`와 `dev-fe`는 각각의 테스트 환경에 연결한다.
- 각 분야의 `release-*`는 해당 운영 배포 환경과 연결한다.
- 하나의 저장소를 사용하되 대상 브랜치와 변경 경로를 기준으로 분야별 CI/CD를 분리한다.
- APP은 Store 배포를 수동으로 진행한다.

```text
feature/201
    │
    └── PR → dev-be
                │
                ├── CI: 빌드·테스트·검증
                ├── Squash Merge
                └── CD → BE 테스트 환경
                         │
                         ▼
                    release-be
                         │
                         └── CD → BE AWS 운영 환경
```

### 운영 장애 대응

- 배포 후 장애는 해당 분야의 `release-*`에서 `hotfix` 브랜치를 생성해 대응한다.
- 운영 장애 대응도 PR과 Squash Merge를 거친다.

```text
release-be → hotfix/301 → PR → Squash Merge → release-be
```

### 롤백

- 이전 정상 Artifact 또는 배포 버전으로 되돌릴 수 있으면 해당 버전으로 Rollback한다.
- 코드 자체를 되돌려야 하면 문제가 된 Squash Commit을 Revert한다.
- 추가 수정이 필요하면 새 GitHub Issue를 발급받아 별도 작업으로 진행한다.
- Rollback과 Fix를 하나의 변경으로 섞지 않는다.
