# Bibbidi Frontend

Next.js App Router, Turbopack, TypeScript를 사용하는 프런트엔드입니다.

## 요구 환경

- Node.js 24 LTS
- pnpm 11

프로젝트에서 사용하는 버전은 `.nvmrc`, `package.json`의 `engines`와 `packageManager`에 명시되어 있습니다.

```bash
node --version
pnpm --version
```

## 시작하기

의존성을 설치합니다.

```bash
pnpm install --frozen-lockfile
```

처음 lockfile을 생성하는 상황에서만 다음 명령을 사용합니다.

```bash
pnpm install
```

개발 서버를 실행합니다.

```bash
pnpm dev
```

기본 주소는 `http://localhost:3000`입니다.

## 디자인 기준 적용

디자인 시스템의 기준을 참고하되 토큰·폰트·스타일은 FE에서 직접 관리합니다.
현재 C1 적용 범위와 전환 대응표는 [공통 기반 적용 기록](docs/design-foundations-migration.md)을 참고하세요.
Select·ListRow·TextField의 공통 동작과 제품 지원 범위는 [공용 컴포넌트 계약](docs/component-contracts.md)에서 확인할 수 있습니다.

## API 연결

로컬 API 주소는 `FE/.env`에서 관리합니다. `.env`는 Git에 포함하지 않습니다.

```dotenv
BIBBIDI_API_BASE_URL=
BIBBIDI_API_PROXY_TARGET=http://localhost:8080
BIBBIDI_CATALOG_API_ORIGIN=http://localhost:8080
```

개발 서버는 `/api` 요청을 `BIBBIDI_API_PROXY_TARGET`으로 전달합니다.
개발 API에 브라우저에서 직접 접근하려면 대신 `BIBBIDI_API_BASE_URL`을 설정합니다.
production에서 FE와 BE의 도메인이 다르면 `BIBBIDI_API_BASE_URL`에 API 기준 주소를 지정합니다.
값을 지정하지 않으면 현재 웹과 같은 도메인으로 `/api` 요청을 전송합니다.

CI와 배포 환경에서 직접 전달한 환경변수는 `.env`보다 우선합니다.

## 명령어

| 명령어 | 설명 |
|---|---|
| `pnpm dev` | Turbopack으로 Next.js 개발 서버를 실행합니다. |
| `pnpm lint` | ESLint로 코드를 검사하고 warning도 오류로 처리합니다. |
| `pnpm lint:fix` | ESLint로 검사하면서 자동 수정 가능한 문제를 수정합니다. |
| `pnpm format` | Prettier로 파일 형식을 자동 정리합니다. |
| `pnpm format:check` | 파일을 수정하지 않고 Prettier 형식 준수 여부를 검사합니다. |
| `pnpm typecheck` | 출력 파일 없이 TypeScript 타입만 검사합니다. |
| `pnpm build` | 타입 검사 후 정적 산출물을 `out/`에 생성합니다. |

빌드 결과물을 별도 정적 서버로 검증할 수 있습니다.

```bash
pnpm dlx serve out
```

## 프로젝트 구조

```text
FE/
├─ public/
│  └─ brand/, landing-story/
├─ app/  # Next.js 경로와 공통 레이아웃
├─ src/
│  ├─ components/
│  ├─ types/
│  ├─ features/
│  ├─ screens/
│  └─ styles/
├─ package.json
├─ tsconfig.json
└─ next.config.mjs
```

## 정적 빌드

빌드 전에 `BIBBIDI_CATALOG_API_ORIGIN`에 환경별 공개 API origin을 지정합니다. 빌드는 인증 없이 `/api/catalog`를 한 번 조회하며, 조회 실패·응답 형식 오류·게시할 준비 항목이 없는 응답에서는 중단합니다. 카탈로그 변경은 API의 카탈로그 캐시를 갱신한 뒤 프런트엔드를 다시 빌드하고 배포하면 반영됩니다. 빌드 ID, 소스 커밋, 카탈로그 해시와 조회 시각은 `.next/catalog-snapshot.json`에 기록합니다.

`pnpm build`는 경로별 HTML과 내부 탐색 데이터를 포함한 정적 사이트를 `out/`에 생성합니다. 문서 URL은 해당 디렉터리의 `index.html`을, 존재하지 않는 URL은 HTTP 404와 `404.html`을 반환하는 정적 호스트에서 확인합니다. 정적 호스트는 API를 프록시하지 않으므로 브라우저 API 주소를 빌드 시 설정하거나 호스트에서 별도 처리해야 합니다. 기존 배포 파이프라인은 Next.js 산출물 배포를 지원할 때까지 차단합니다.

## 패키지 관리 규칙

- 이 프로젝트에서는 pnpm만 사용합니다.
- `pnpm-lock.yaml`은 Git에 포함합니다.
- `package-lock.json`과 `yarn.lock`을 생성하지 않습니다.
