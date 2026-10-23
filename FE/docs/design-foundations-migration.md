# 서비스 UI C1 — 토큰·폰트·레이아웃 적용

적용일: 2026-10-23. 작업 이슈: [#604](https://github.com/woowacourse-teams/2026-bibbidi/issues/604). `bibbidi-design`의 Foundations를 참고해 FE 자체 구현에 반영했다. 런타임 import, 패키지 의존성, 저장소 간 자동 동기화는 없다. 이후 변경도 서비스에서 직접 검토·관리한다.

## 기준과 파일

- 기준: `bibbidi-design/src/styles/tokens.css`, Typography·Colors·Layout 문서.
- 로컬 폰트 로딩: `src/styles/fonts.css`. 토큰 값과 파일 로딩 선언을 분리한다.
- FE 값의 원본: `src/styles/tokens.css`. 문서 사이트 전용 테마와 전역 스타일은 포함하지 않는다.
- 기존 화면의 색상 이름 호환: `src/styles/colors.css`.
- 공통 헤더 여백: `src/styles/layout.css`.
- 진입점의 적용 순서: fonts → tokens → 색상 별칭 → 공통 컨테이너·여백 → 전역 기본 스타일.
- 다음 표의 숫자와 HEX는 **변경 전 FE 값**이다. 새 값은 FE 토큰을 기준으로 확인한다.

## 색상 대응

| 변경 전 FE | 적용 기준 | 결과 |
| --- | --- | --- |
| 브랜드 배경 coral `#e88471` | `--color-bg-brand-solid` → Gold | 버튼·강조 배경 전환 |
| 눌림 `#d56f5e` | `--color-bg-brand-solid-pressed` | Gold 눌림색 사용 |
| cream `#f8e8c1` | `--color-bg-brand-weak` | 약한 브랜드 배경 전환 |
| 랜딩 yellow `#fdda6e` | `--color-palette-gold` | 랜딩의 혼합색도 Gold 기준으로 계산 |
| 브랜드 위 흰 글자 | `--color-fg-on-brand` | Gold 위 Ink 글자 사용 |
| 브랜드 글자 `#8a493f`, `#5b5147` | `--color-fg-neutral` | 기존 `--color-fg-brand`, `--color-fg-brand-contrast`는 임시 별칭으로 유지 |
| coral-muted `#c58f80`의 글자 | `--color-fg-neutral` | 할 일 강조 숫자를 어두운 글자로 전환 |
| coral-muted의 진행률 배경 | `--color-bg-brand-solid` | 준비 요약의 진행률 막대 전환 |
| coral-muted의 선 | `--color-stroke-brand-solid` | 진행률 원과 로드맵 연결선 전환 |
| 브랜드 선 `#e88471`, `#e7d9b7` | `--color-stroke-brand-solid`, `--color-stroke-brand-weak` | 동일한 역할 토큰 이름으로 전환 |
| 위험 글자·선 `#fa342c` | `--color-fg-critical`, `--color-stroke-critical-solid` | 디자인 시스템의 Red로 전환 |
| 중립·정보·긍정·포커스 | 동일한 역할 토큰 | 기존 의미와 값을 유지 |

기존 코랄·옐로 팔레트 이름은 제거했다. 소셜 로그인 제공자 색상과 이미지 자체의 색상은 이 전환 대상에 포함하지 않는다. 랜딩 AI 예시의 지역 브랜드 글자 별칭은 해당 화면의 강조 글자색을 계속 따른다.

## 글꼴·타이포그래피 대응

| 변경 전 FE | 적용 기준 | C1 상태 |
| --- | --- | --- |
| body Inter + 시스템 글꼴 | `--typography-t5`, `--font-family-ui` | Pretendard Variable을 로컬 WOFF2로 적용 |
| 랜딩 Pretendard 이름만 지정 | `--font-family-ui` | 실제 내려받는 UI 글꼴과 통일 |
| 로고 Nunito 900, 22px, 행간 1, 음수 자간 | `--typography-brand`, `--letter-spacing-ui` | 기존 Nunito 900 서브셋을 재사용하고 글꼴 선언을 fonts.css에 모음 |
| button·input만 글꼴 상속 | button·input·textarea·select 상속 | 입력 요소의 기본 글꼴 통일 |
| 화면별 제목·본문의 개별 크기 | `--typography-t1`~`--typography-t7`, Medium | 토큰 제공 완료. 화면별 위계 변경은 해당 화면 개편에서 적용 |

Pretendard는 UI 전체에, Nunito는 `bibbidi` 워드마크에 사용한다. Nunito 서브셋은 b·d·i만 포함하므로 다른 문구에는 사용하지 않는다. 폰트 경로는 CSS 파일 기준 상대 경로이며 Webpack이 해시 자산으로 출력한다. CDN이나 디자인 시스템 서버에 요청하지 않는다. 라이선스는 `src/assets/fonts/`에서 관리한다.

## 레이아웃·중단점 대응

| 변경 전 FE | 적용 기준 | C1 상태 |
| --- | --- | --- |
| 모바일 CSS 최대 760px, 데스크톱 최소 761px | `--layout-breakpoint-md` | CSS `(width < 768px)`와 JS `MOBILE_LAYOUT_MEDIA_QUERY`를 함께 변경 |
| 랜딩 모션의 `innerWidth <= 760` | 실제 랜딩 헤더 높이 | CSS로 결정된 높이를 읽어 스크롤 계산에 사용 |
| 로그인 상단 여백의 최소 744px 분기 | `--layout-breakpoint-md` | 모바일 규칙과 겹치지 않도록 정렬 |
| 공통 헤더 최대 1440px | `--layout-width-wide` | 공통 `.service-page-container`로 서비스·인증 헤더에 적용 |
| 헤더 좌우 16px / 24px, 작은 화면 12px 예외 | `--layout-margin-mobile/tablet/desktop` | `--service-page-margin`으로 공유. lg부터 데스크톱 여백 사용 |
| 헤더의 준비 요약 고정 360px | `--layout-breakpoint-lg` 전까지 요약을 축약 | 태블릿에서 메뉴와 요약이 겹치지 않도록 적용 |
| 하단 독 좌우 16px, 본문 하단 추가 여백 16px | 같은 모바일 여백 토큰 | 안전 영역 및 기존 독 높이와 함께 적용 |
| 랜딩 본문 최대 1180px | `--layout-width-content/wide` | 랜딩 개편 단계에서 적용 |
| 체크리스트 본문 최대 1680px, 카테고리 180px, 상세 480px | `--layout-width-wide/category/detail/main-min` | 상세·작성 레이어 개편과 함께 적용 |
| 캘린더 본문 최대 1440px, 내부 1200px 분기 | Workspace와 lg 기준 | 캘린더 개편 단계에서 적용 |
| 로그인 폼 352px, 가입 1열 | `--layout-width-login-form/auth/focus` | 인증 화면 개편 단계에서 적용 |

CSS 미디어 조건에는 CSS 변수를 사용할 수 없어 수치를 작성한다. FE 토큰의 md를 바꿀 때는 `shared/responsive.ts`, CSS의 모바일/데스크톱 조건, 해당 경계를 사용하는 테스트를 함께 변경한다. lg/xl은 공통 값만 준비했으며 기존 화면의 내부 보조 중단점(390·520·600·1000·1199·1200 등)을 일괄 치환하지 않았다.

태블릿의 상세 오버레이, 데스크톱에서 본문 최소 너비를 확보한 뒤 상세를 병렬로 여는 동작, wide 3열 전환은 C3·C6 및 각 화면 구현에서 다룬다. C1은 공통 기반 적용이며 화면 개편 전체의 완료를 뜻하지 않는다.

## 검증

- `pnpm build`, `pnpm lint` 통과. `pnpm test`: 97개 파일, 1,156개 테스트 통과.
- Chrome에서 게스트·로그인 응답을 모킹해 320·390·760·767·768·1024·1279·1280·1439·1440px을 확인했다. 공통 헤더의 겹침·가로 넘침과 모바일 탐색 전환을 검사했다.
- Pretendard·Nunito 로컬 로딩, Gold 역할색, 문서 테마 미포함을 확인했다.
- 상세를 연 채 md 경계를 왕복했을 때 선택 항목이 유지되고 레이어/패널이 전환되는지 확인했다. 소수점 너비의 iframe에서도 CSS와 JS의 미디어 판정이 일치했다.
- 빌드에는 자산·진입 번들 크기 경고가 남아 있다. Pretendard 단일 WOFF2는 약 2MB이며 서브셋 최적화는 별도 작업이다.
- 실제 서버의 로그인·저장·일정 변경은 후속 흐름 검증 범위다.

## 책임·중복 점검

- 폰트 자산 로딩(`fonts.css`), 디자인 값(`tokens.css`), 이전 색상 이름 호환(`colors.css`), 공통 컨테이너·반응형 여백(`layout.css`)을 구분했다.
- 로그인 페이지의 효과 없는 데스크톱 여백 재선언을 제거했다. 랜딩 모션의 중복 중단점·헤더 높이 판정은 실제 헤더 높이를 읽는 공통 계산으로 바꿨다.
- 모바일 동작 테스트는 `MOBILE_LAYOUT_MEDIA_QUERY`를 가져다 사용한다. CSS의 미디어 조건에 필요한 숫자는 유지한다.
- 현재 참조가 없는 T1~T4·T6~T7, 일부 레이아웃 너비·그리드 토큰은 디자인 기준의 공통 값으로 유지한다. 개별 화면에 이 값을 적용하는 실행 코드는 추가하지 않았다.
- 기존 브랜드 글자 별칭은 서비스와 랜딩 AI 예시에서 사용 중이므로 유지한다.
- `tsc --noEmit --noUnusedLocals --noUnusedParameters`를 통과했다. 실제 헤더 높이가 바뀔 때 랜딩 이동 위치가 함께 바뀌는 회귀 테스트를 추가했다.


## 체크리스트 Layout 후속 적용 — #635

공통 `components/page-container`와 `components/workspace-layout`을 FE에서 관리하고 체크리스트에 먼저 적용했다. 디자인 시스템의 구현을 참고했으며 저장소 간 import나 패키지 의존성은 추가하지 않는다. C1에서 미뤘던 체크리스트 본문·카테고리·상세 너비를 기존 `--layout-*` 토큰에 맞췄다.

- PageContainer는 최대 너비와 뷰포트별 바깥 여백을 담당한다. 기존 헤더의 `.service-page-container`는 유지한다.
- `useWorkspaceLayout`은 뷰포트 중단점과 ResizeObserver로 확인한 실제 본문 너비를 함께 판정한다. WorkspaceLayout은 그 결과에 따라 탐색·본문·보조 슬롯을 배치한다. 레이아웃 측정과 화면의 레이어 동작을 연결할 수 있도록 FE에서는 훅을 별도로 제공한다.
- 카테고리는 상단 가로 탐색을 기본으로 하고, xl 이상에서 카테고리와 본문 최소 너비를 확보하면 측면에 둔다. 보조 영역은 lg 이상이면서 본문 최소 너비·간격·패널 너비를 확보할 때만 병렬 배치한다.
- 모바일 상세 바텀시트·작성 전체 화면을 유지한다. 태블릿과 너비가 부족한 데스크톱에서는 오른쪽 오버레이를 사용한다. 할 일 추가·일정 추가/수정에도 같은 전환을 적용한다.
- 선택·작성값·URL은 기존 기능 컨트롤러가 관리한다. 오버레이는 기존 DOM 기반 확인창과 함께 동작하도록 구성하고 배경 조작·페이지 스크롤을 막는다. 닫기·저장 중 제한·변경 버리기 정책은 기존 컨트롤러에 위임한다.
- 목록은 기존 서비스 본문에서 스크롤하고, 병렬 패널은 화면에 남아 내부 본문을 스크롤한다. 피드백 버튼이 예약하는 보조 영역 너비도 실제 병렬 패널과 같은 토큰을 따른다.

CSS의 md·lg 조건을 바꾸면 관련 CSS와 공통 responsive.ts를 함께 맞춘다. WorkspaceLayout의 너비 판정은 CSS에서 읽은 px 레이아웃 토큰을 사용한다. 목록 행과 폼 내용의 디자인 교체는 이 작업에 포함하지 않는다.
