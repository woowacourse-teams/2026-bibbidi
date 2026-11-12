# 프런트엔드 변경 내역

## Unreleased

## 1.0.0

- 운영 프런트엔드를 Webpack 기반 CSR에서 Next.js 정적 빌드로 전환합니다. 홈과 준비 목록의 공개 카탈로그는 HTML에 담고, 개인 데이터는 접속 후 가져옵니다. [#822](https://github.com/woowacourse-teams/2026-bibbidi/pull/822) [#825](https://github.com/woowacourse-teams/2026-bibbidi/pull/825)
- 개발과 운영 배포의 `version.json`에 버전, 커밋, 변경 내역 링크를 기록합니다. 운영에서는 릴리스별로 정적 파일을 보관해 이전 버전으로 돌아갈 수 있습니다. [#832](https://github.com/woowacourse-teams/2026-bibbidi/pull/832) [#833](https://github.com/woowacourse-teams/2026-bibbidi/issues/833)

## 0.1.0

개발 버전에 사용하는 기존 FE 패키지의 기준 버전입니다.

- Next.js App Router로 이관하고 정적 HTML을 생성합니다. [#822](https://github.com/woowacourse-teams/2026-bibbidi/pull/822)
- 홈과 준비 목록의 공개 카탈로그를 빌드 시 HTML에 담습니다. 개인 준비 현황은 접속 후 갱신합니다. [#825](https://github.com/woowacourse-teams/2026-bibbidi/pull/825)
- 개발 배포에서 정적 산출물을 보관하고, S3 게시와 CloudFront 캐시 무효화 후 공개 응답을 검증합니다. [#829](https://github.com/woowacourse-teams/2026-bibbidi/pull/829)
