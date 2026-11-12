# 운영 프런트엔드 정적 릴리스

운영 CodeBuild는 `release-fe`의 정적 산출물을 별도 S3 경로에 올립니다. CodeBuild가 성공해도 운영 도메인은 기존 배포를 계속 제공합니다. 운영 트래픽은 CloudFront를 전환하고 확인한 뒤 새 릴리스로 넘어갑니다.

## 1. 후보 빌드와 버전 확인

1. `FE/package.json`의 `MAJOR.MINOR.PATCH`와 `FE/CHANGELOG.md`의 같은 버전 제목을 확인합니다. 첫 정식 릴리스는 `1.0.0`입니다.
2. `bibbidi-fe-production-build`가 `release-fe`의 병합 커밋을 소스로 사용하고 `infra/frontend/buildspec.yml`을 읽는지 확인합니다. 빌드가 자동으로 시작하지 않으면 해당 커밋으로 실행합니다.
3. CodeBuild 로그의 `s3://techcourse-project-2026/bibbidi/fe/production/releases/<releaseId>/`를 기록합니다. `releaseId`는 Git 커밋과 CodeBuild 실행 UUID의 조합입니다.
4. S3에서 `release-manifest.json`과 `version.json`의 버전·커밋이 빌드와 일치하는지 확인합니다. 매니페스트는 파일 업로드가 끝나면 마지막에 생성되며, 정적 파일의 크기와 SHA-256을 담습니다. 루트와 공개 페이지의 HTML, Next 정적 파일 및 공개 카탈로그를 전환 전에 확인합니다. 빌드와 브라우저 모두 운영 API `https://api.bibbidi.kr`를 사용합니다.

## 2. 최초 전환

1. 배포 `EHMGV04SPRCWI`의 현재 설정과 운영 [version.json](https://bibbidi.kr/version.json)을 기록합니다. 복구에 필요한 항목은 Default behavior의 origin과 함수 연결, 오류 응답, 캐시 정책입니다.
2. 기존 S3 버킷과 OAC를 사용하는 별도 origin을 추가합니다. Origin path는 `/bibbidi/fe/production/releases/<releaseId>`로 설정합니다. 기존 SPA origin과 파일은 남겨 둡니다.
3. [라우팅 함수](../../infra/frontend/production-routing.js)를 CloudFront Function으로 생성해 `/`, `/preparation/?categoryId=1`, `/auth/kakao/`, 정적 파일 요청을 테스트한 뒤 Publish합니다. 쿼리는 유지되고 문서 요청만 각 경로의 `index.html`로 연결되어야 합니다.
4. 기존 `/icon/*` 동작을 유지합니다. 이미 열린 SPA가 정적 파일을 계속 가져올 수 있도록 `/assets/*`를 기존 SPA origin으로 보내는 동작을 추가합니다.
5. Default behavior의 origin을 새 후보로 바꾸고 새 함수를 Viewer request에 연결합니다. 기존 Viewer response의 `bibbidi-internal-traffic-cookie` 연결은 유지합니다. 응답 캐시 정책은 최소 TTL이 0이고 원본의 `Cache-Control`을 존중해야 합니다. 쿼리 문자열 전달과 캐시 키 설정은 기존 용도에 맞게 유지합니다.
6. S3의 누락된 객체 응답인 403·404를 `/404.html` 및 HTTP 404로 매핑하고 오류 캐시 TTL을 0으로 설정합니다. 배포 설정 반영 후 `/*` 캐시 무효화를 실행합니다.

## 3. 전환 확인 및 Git 태그

- 운영 [version.json](https://bibbidi.kr/version.json)과 [release-manifest.json](https://bibbidi.kr/release-manifest.json)의 버전·커밋·릴리스 ID가 후보와 같은지 확인합니다.
- `/`, `/preparation/?categoryId=1`, `/calendar/`의 직접 접속과 새로고침을 확인합니다. Next 정적 파일과 페이지 이동용 `.txt`, 기존 `/assets/*` 및 `/icon/*`도 확인합니다. 없는 페이지는 404를 반환해야 합니다.
- 운영 웹과 앱 WebView에서 로그인·소셜 로그인 콜백, 로그인 후 개인 데이터, 밸런스 게임을 확인합니다. 운영에서 사용 중인 분석 및 에러 수집 설정도 유지되었는지 확인합니다.
- 검증을 통과한 커밋에 `fe/v1.0.0` 태그를 만듭니다. 같은 태그가 이미 다른 커밋에 붙어 있다면 이동하지 않고 다음 버전을 사용합니다. 태그를 올린 뒤 같은 버전의 GitHub Release를 만들고 변경 내역과 검증한 릴리스 ID를 연결합니다.

  ```sh
  git tag -a fe/v1.0.0 <verified-release-commit> -m "Frontend v1.0.0"
  git push origin refs/tags/fe/v1.0.0
  ```

## 4. 롤백

최초 전환 직후 문제가 생기면 Default behavior를 기존 SPA origin으로 되돌리고, Viewer request와 403·404 응답을 전환 전에 기록한 설정으로 복원합니다. `/*` 무효화 후 이전 `version.json`의 커밋, 홈, 내부 경로 직접 접속을 확인합니다.

다음 정적 릴리스부터는 CloudFront의 기본 origin을 이전에 검증한 릴리스 경로로 되돌릴 수 있습니다. 릴리스 경로는 빌드마다 분리되어 있으므로 이전 후보를 삭제하지 않습니다. 다음 정적 릴리스로 넘어가기 전에는 이미 열린 Next.js 페이지가 이전 버전의 `/_next/static/*` 파일을 계속 읽을 수 있도록 보관 및 제공 방식을 확인해야 합니다.
