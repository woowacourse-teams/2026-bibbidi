# Bibbidi Frontend

Webpack, React, TypeScript를 직접 구성한 Bibbidi 프론트엔드 프로젝트입니다.

Webpack과 번들링 요소의 상세 설명은 [Webpack 기반 React & TypeScript 개발환경 구성 가이드](docs/WEBPACK_REACT_TYPESCRIPT_GUIDE.md)에서 확인할 수 있습니다.

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

## API 연결

로컬 API 주소는 `FE/.env`에서 관리합니다. `.env`는 Git에 포함하지 않습니다.

```dotenv
BIBBIDI_API_BASE_URL=
BIBBIDI_API_PROXY_TARGET=http://localhost:8080
```

개발 서버는 `/api` 요청을 `BIBBIDI_API_PROXY_TARGET`으로 전달합니다.
해당 값이 없으면 설정 누락 오류와 함께 개발 서버 실행을 중단합니다.
production에서 FE와 BE의 도메인이 다르면 `BIBBIDI_API_BASE_URL`에 API 기준 주소를 지정합니다.
값을 지정하지 않으면 현재 웹과 같은 도메인으로 `/api` 요청을 전송합니다.

CI와 배포 환경에서 직접 전달한 환경변수는 `.env`보다 우선합니다.

## 명령어

| 명령어 | 설명 |
|---|---|
| `pnpm dev` | Webpack development 모드로 개발 서버를 실행합니다. |
| `pnpm lint` | ESLint로 코드를 검사하고 warning도 오류로 처리합니다. |
| `pnpm lint:fix` | ESLint로 검사하면서 자동 수정 가능한 문제를 수정합니다. |
| `pnpm format` | Prettier로 파일 형식을 자동 정리합니다. |
| `pnpm format:check` | 파일을 수정하지 않고 Prettier 형식 준수 여부를 검사합니다. |
| `pnpm typecheck` | 출력 파일 없이 TypeScript 타입만 검사합니다. |
| `pnpm build` | 타입 검사 후 production 번들을 `dist/`에 생성합니다. |

빌드 결과물을 별도 정적 서버로 검증할 수 있습니다.

```bash
pnpm dlx serve dist
```

## 프로젝트 구조

```text
FE/
├─ public/
│  └─ index.html
├─ src/
│  ├─ components/
│  ├─ types/
│  ├─ App.tsx
│  ├─ index.tsx
│  └─ styles.css
├─ package.json
├─ pnpm-lock.yaml
├─ tsconfig.json
└─ webpack.config.js
```

## 빌드 흐름

```text
src/index.tsx
    ↓ import 관계 분석
TypeScript, TSX, CSS, 이미지
    ↓ loader 및 Asset Modules 처리
Webpack 의존성 그래프
    ↓ 최적화 및 파일 분리
dist/index.html + JavaScript + CSS
```

## 주요 설정

### Entry와 Output

- `entry`: Webpack이 분석을 시작하는 `src/index.tsx`입니다.
- `output`: production 결과물이 생성되는 `dist/`입니다.
- JavaScript와 CSS 파일 이름에 content hash를 사용하여 브라우저 캐시를 관리합니다.
- `output.clean`으로 이전 빌드 결과를 정리합니다.

### Loader

- `ts-loader`: TypeScript와 TSX를 JavaScript로 변환합니다.
- `css-loader`: CSS의 import와 URL을 해석합니다.
- `style-loader`: development에서 CSS를 브라우저에 주입합니다.
- production에서는 `mini-css-extract-plugin`으로 CSS 파일을 분리합니다.

Webpack loader 배열은 오른쪽에서 왼쪽 순서로 실행됩니다.

### Plugin

- `HtmlWebpackPlugin`: HTML을 생성하고 해시가 붙은 번들을 자동 연결합니다.
- `MiniCssExtractPlugin`: production에서 CSS를 별도 파일로 출력합니다.

loader는 파일을 변환하고 plugin은 빌드 전체 과정에 기능을 추가합니다.

### Development와 Production

development 빌드는 빠른 빌드, Source Map, HMR을 우선합니다. production 빌드는 코드 압축, 청크 분리, content hash를 적용합니다.

`webpack-dev-server`는 개발용 서버이며 실제 운영 서버가 아닙니다. 운영에서는 `pnpm build`로 만든 `dist/`를 AWS Amplify Hosting 등의 정적 호스팅에 배포합니다.

## 자주 확인할 오류

| 증상 | 확인할 곳 |
|---|---|
| 모듈을 찾지 못함 | import 경로, 파일명 대소문자, `resolve.extensions` |
| TSX를 처리하지 못함 | `ts-loader`, `tsconfig.json`의 `jsx` |
| CSS가 적용되지 않음 | CSS import, loader 설정과 순서 |
| 화면이 비어 있음 | `public/index.html`의 `#root`, 브라우저 콘솔 |
| 상세 URL 새로고침 시 404 | 개발 서버 및 배포 환경의 SPA fallback |
| 로컬 성공, CI 실패 | Node/pnpm 버전, lockfile, 파일명 대소문자 |
| 번들이 지나치게 큼 | 대형 라이브러리·이미지, 중복 의존성, 코드 분할 |

## 패키지 관리 규칙

- 이 프로젝트에서는 pnpm만 사용합니다.
- `pnpm-lock.yaml`은 Git에 포함합니다.
- `package-lock.json`과 `yarn.lock`을 생성하지 않습니다.
- Webpack과 TypeScript는 전역 설치하지 않고 프로젝트 의존성으로 관리합니다.

## 의존성 업데이트 주의사항

TypeScript는 현재 `ts-loader`와 정상적으로 연동되는 `6.0.3`으로 고정되어 있습니다. TypeScript 또는 loader의 메이저 버전을 변경할 때는 `pnpm typecheck`와 `pnpm build`를 함께 실행하여 호환성을 확인해야 합니다.
