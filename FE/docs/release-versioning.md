# 프런트엔드 릴리스 버전과 복구

## 버전과 변경 내역

FE는 `FE/package.json`의 `version`을 기준으로 버전을 관리한다. 외부에 제공하는 URL과 쿼리, OAuth 콜백, 앱 연동 계약을 호환성 판단 대상으로 삼는다. 한 릴리스에 여러 변경이 들어가면 가장 큰 영향을 기준으로 번호를 정한다. [시맨틱 버저닝 명세](https://semver.org/lang/ko/)

| 구분 | 버전 결정 기준 | 예시 |
| --- | --- | --- |
| Major | 공개 계약과 호환되지 않는 변경 | 기존 앱이 사용하는 콜백 경로 제거 |
| Minor | 기존 계약을 유지하면서 기능 추가 | 기존 링크를 유지한 채 공개 탐색 기능 추가 |
| Patch | 기존 계약을 유지하면서 오류 수정 | 카테고리 쿼리 복원 오류 수정 |

`0.x.y`는 정식 FE 버전 확정 전 단계다. 이 기간에는 호환성에 영향이 있는 변경도 릴리스 노트에 기록한다. 기존 공통 `v1.0.0`은 MVP 기록이며, 독립 FE 안정 릴리스의 기준 커밋과 버전은 운영 산출물 확인 후 정한다. [기존 분야별 버전 정책](https://github.com/woowacourse-teams/2026-bibbidi/issues/355)

- 변경 PR은 사용자에게 영향을 주는 내용과 PR 링크를 `FE/CHANGELOG.md`의 `Unreleased`에 추가한다.
- 기준 버전을 올릴 때 `FE/package.json`과 `FE/CHANGELOG.md`를 한 PR에서 수정하고, `Unreleased`의 릴리스 대상 항목을 새 버전 제목 아래로 옮긴다. 배포 스크립트는 기준 버전 형식과 해당 버전 제목을 검사한다.
- `dev-fe`의 CodeBuild는 개발 빌드마다 `0.1.0-dev.123` 같은 사전 릴리스 버전을 붙인다. `123`은 CodeBuild의 빌드 번호이며, 같은 커밋을 다시 빌드해도 빌드 번호는 달라진다.
- 운영 안정 릴리스에는 검증한 소스 커밋의 `fe/vX.Y.Z` 태그와 GitHub Release를 연결한다. 기존 태그는 보존한다. [운영 전환 및 복구 절차](production-static-release.md)에 따라 공개 버전 확인을 마친 뒤 태그와 GitHub Release를 게시한다.

## 현재 개발 배포 확인

[개발 서버의 `/version.json`](https://dev.bibbidi.kr/version.json)에서 `version`, `commit`, `buildId`, `releaseId`를 확인한다. `changelogUrl`은 이 빌드의 소스 커밋에 있는 변경 내역을 가리킨다. `/release-manifest.json`에는 같은 정보와 게시한 파일의 SHA-256이 들어 있다. 배포 이전 보관본에도 동일한 파일 목록과 빌드 정보가 있으며, SemVer 도입 이전 보관본은 커밋과 빌드 ID로 식별한다.

## 이전 개발 버전 복구 기준

1. 배포 로그의 `Previous release archive`에서 직전 서비스의 `releaseId`를 찾는다. 해당 CodeBuild가 `Succeeded`였는지 확인하고, 보관본의 `version.json`과 `release-manifest.json`의 커밋·빌드·릴리스 ID가 그 실행과 일치하는지 확인한다. manifest는 `development/releases/<releaseId>/release-manifest.json`에 있다. 카탈로그와 환경 변수가 바뀔 수 있으므로 그 실행에서 생성한 파일을 복구 대상으로 사용한다.
2. 개발 파이프라인에 진행 중이거나 대기 중인 배포가 없는 시간에 복구한다. 보관본을 다운로드해 manifest의 파일 목록과 SHA-256을 확인한다. 보관본의 전체 export를 `s3://techcourse-project-2026/bibbidi/fe/development/`에 복사한다. 기존 해시 에셋과 다른 릴리스 보관본을 보존하고 원본 객체의 캐시·콘텐츠 유형 메타데이터를 유지한다. `release-manifest.json`과 `version.json`은 export가 올라간 후 순서대로 복사한다.
3. 개발 CloudFront 배포 `E3TM3MDSJWPEW5`의 `/*` 캐시 무효화를 요청한다. 공개 `/version.json`이 복구 대상의 정보를 반환하는지, `/index.html`과 `/calendar/index.txt`의 해시가 복구 manifest와 일치하는지 확인한다. 브라우저에서 홈과 캘린더 이동도 확인한다. 수행 시각, 복구 전후 릴리스, 검증 결과를 이슈에 남긴다.

고정 경로에 파일을 복사하는 동안에는 서로 다른 릴리스의 파일이 잠시 제공될 수 있다. 복구 과정에서 다른 배포가 겹치면 공개 버전과 파일을 다시 대조한다. 운영의 현재 버전은 [운영 `/version.json`](https://bibbidi.kr/version.json)에서 확인한다. 최초 전환 전에는 기존 배포의 커밋과 빌드 ID가 표시된다.
