# 디자인 시스템과 제품 공용 컴포넌트의 계약

`bibbidi-design`과 제품의 `src/components`는 별도 구현이다. 디자인 시스템 문서의 모든 API를 제품에서 지원한다고 가정하지 않는다. 공통 동작은 같은 의미로 유지하고, 제품이 지원하는 범위와 서비스 정책은 이 문서에서 구분한다. 추상화 경계는 디자인 시스템의 Foundations → Composition을 따른다.

## Select

공통 API는 단일·다중 선택, `value/defaultValue`, `open/onOpenChange`, `closeOnSelect`, `labelHidden/listLabel`, `variant="box" | "inline"`, `loading`, 안내·오류, 폼 연결과 `SelectHandle.focus()`이다.

- 새 값을 단일 선택하면 기본적으로 닫힌다. `closeOnSelect={false}`이면 사용처가 저장 결과에 따라 값을 확정하고 닫는다. 현재 값을 재선택하면 변경 요청 없이 닫힌다. 다중 선택은 목록을 유지한다.
- `loading`은 중복 선택을 막고 열린 목록과 버튼 초점을 유지한다. 저장 요청, 성공 시 값 반영, 실패 시 기존 값과 오류 유지, 확인창 등은 기능에서 결정한다.
- 목록은 같은 DOM 안에서 네이티브 Popover top layer로 표시해 모달의 접근성 범위를 유지한다. Popover 미지원 환경은 네이티브 select로 대체한다. 이 환경에서는 브라우저 팝업의 열림을 `open`이나 `closeOnSelect`로 제어할 수 없고, loading은 select를 비활성화한다.
- ref는 DOM 노드 대신 `SelectHandle`을 받는다. 버튼과 네이티브 대체 환경 모두 `focus(options?)`를 제공한다.

## ListRow.Description

`dl`의 직접 자식으로 사용한다. `term`은 `dt`, `description`은 `dd`이며 `border`, `verticalPadding`, `horizontalPadding`은 일반 행과 같은 의미다. 행 전체를 버튼으로 만들지 않고 값 안에 독립적인 컨트롤을 조합한다. 값의 오른쪽 정렬이나 업무별 상태·문구는 사용처가 결정한다.

일반 행·Description·Loader의 `horizontalPadding`은 `none | small | medium`이며 각각 0 / 20 / 24px이다. 기본값은 `medium`이다. Panel·BottomSheet처럼 부모가 본문 여백을 제공하면 `none`을 사용한다. 구분선은 행의 좌우 여백에 맞춰지므로 `none`에서는 행 양 끝까지 이어진다.

## ListHeader

목록·정보 그룹의 제목, 보조 설명, 우측 콘텐츠를 담당한다. `title`, `titleId`, `description`, `right`, `headingLevel`, `horizontalPadding`과 표준 header 속성·ref를 디자인 시스템과 같은 의미로 지원한다. 기본 제목 계층은 h2이며 패널 제목이 h2인 내부 섹션은 h3으로 지정한다. 우측 버튼은 제목 요소 밖에 배치한다.

헤더와 행은 같은 좌우 여백을 사용한다. 부모가 여백을 제공하지 않으면 기본 `medium`을, 패널 본문처럼 부모가 여백을 제공하면 둘 다 `none`을 사용한다. 섹션의 `aria-labelledby`, 일정 개수와 권한·이벤트·포커스 복귀는 화면에서 연결한다. 체크리스트 상세의 ‘할 일 정보’와 ‘일정 N개’에 적용하며 패널 전체 제목은 `Panel.Header`가 담당한다.

## TextField

공통으로 기본 입력·Button, label·help·hasError·labelHidden, 폼과 접근성 연결을 지원한다. labelHidden은 값이 있어도 시각적 라벨을 숨기며 접근성 이름을 유지한다. Button의 required는 필수 표시·설명을 제공하고, 선택값 검증과 제출 차단은 사용처가 맡는다.

| 기능 | 제품 지원 범위 | 디자인 시스템과의 차이 |
| --- | --- | --- |
| 라벨 기본값 | 항상 표시 | DS는 labelOption="appear"가 기본값. DS에서 동일하게 표시하려면 sustain 지정 |
| variant | box, line | DS는 big, hero도 지원 |
| labelHidden | 입력과 Button 모두 지원 | 공통 의미 유지 |
| labelOption | 미지원 | 제품은 labelHidden으로 표시 여부 제어 |
| Clearable, Password | 미지원 | 필요 시 구현·검증 후 도입 |
| prefix, suffix | 장식용 API 미지원 | 네이티브 input 속성을 DS API로 간주하지 않음 |
| right | 기본 입력에서 지원 | DS는 Button에서도 장식용 요소 교체 지원 |
| 입력 type | 네이티브 input 타입 | DS는 문서화된 텍스트 입력 타입으로 제한 |

라벨 기본값 차이는 기존 제품 폼의 배치를 유지하기 위한 것이다. 제품을 DS 전체 구현으로 교체할 때는 라벨 표시, 폼 초기화, 지원 타입과 ref를 함께 검증한다.

## PageHeader

`PageHeader`는 디자인 시스템과 같은 제목·설명·상단 탐색·액션 슬롯, 제목 계층과 표준 header 속성을 지원한다. 제목과 액션의 반응형 배치는 헤더 자체의 너비를 기준으로 한다. 카테고리·완료 개수·로그인 안내·동작과 포커스 복귀는 기능이 결정하며, 주변 여백은 화면에서 관리한다. 체크리스트와 로드맵이 같은 규격을 사용한다.

## 제품 공용 조합

`PickerField`는 제품에 둔다. 날짜·시간 필드, 모바일 BottomSheet·데스크톱 Popover 전환, 임시 선택 후 확인은 제품의 공용 조합 정책이다. 구성 요소의 기본 동작은 공용 컴포넌트가 제공하고, 제품 조합이 DS에 없다는 이유만으로 새 DS 컴포넌트를 만들지 않는다.
