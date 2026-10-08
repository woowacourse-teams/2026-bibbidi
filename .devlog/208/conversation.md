# 작업 대화 기록

Issue #215 구현 과정에서 오간 대화 전문이다. Development Logger의 hook이 `release-be`에서 Node 24를 요구해
로컬 Node 20으로는 실행되지 않아 `events.jsonl`이 설계 질문 단계에서 멈췄다. 그 뒤 기록을 세션 transcript에서
사람과 Claude의 발화만 뽑아 남긴다. 도구 호출과 그 결과는 뺐다.

이 저장소는 공개 저장소다. 실사용자 수, 전환·이탈 지표, 팀 회의에서 오간 발언, 팀원 지칭은
`N명`이나 `[비공개]` 같은 표시로 가린다. 설계 판단의 근거는 그대로 둔다.

## 1. 사용자 · 2026-09-21T08:47:26.738Z

BIBBIDI_SOCIAL_LOGIN_DESIGN.md


이거 참고해서

개발해줘

PR 단위로 나한테 묻지말고

너가 알아서 판단해

그 인터뷰 하는 것도 자료 바탕으로 너가 알아서 판단해줘

깃허브 이슈 208번과 다운로드에 최근 txt에 있는 내용도 참고해서 

ADR 쓸꺼 없으니깐 PR까지 알아서 진행해줘

## 2. Claude · 2026-09-21T08:54:16.846Z

I have the design doc, issue #208/#210, the meeting transcript, and the BE code. Recording the design decisions in the work log.

설계 판단은 자료로 끝냈고 작업 기록에 넣었어. **Development Logger가 "설계 질문에 대한 개발자 답" 이벤트 하나를 요구해서**, 코드 수정 게이트를 풀려면 네 답변 한 번이 물리적으로 필요해. 아무 말이나 한 줄 주면 바로 구현 들어감.

## 이번 PR 범위: 설계 문서 7절 1단계만

`feature/208` → `release-be`. **닉네임 유일 제약을 떼고 기존 비밀번호 로그인의 식별자를 분리**하는 변경 하나로 닫는다.

| 항목 | 결정 |
|---|---|
| 로그인 식별자 | `users.password_login_id` (UNIQUE, NULL 허용) 신설 + 기존 닉네임 이관 |
| 로그인 API | 요청 본문 `nickname` 필드 유지, 서버가 내부에서 `password_login_id`와 대조 |
| 닉네임 | UNIQUE 제거, `VARCHAR(10)` → `VARCHAR(255)` |
| 중복 확인 API | 경로·응답 그대로, 검사 대상만 `password_login_id`로 |
| 닉네임 변경 | `DUPLICATE_NICKNAME` 더 이상 안 던짐 |
| 마이그레이션 | `002_*.sql` 추가 + `bibbidi_mvp_schema.sql` 동기화 |

회의에서 나온 `(nickname, password_hash)` 복합 유니크 안은 안 쓴다. 비밀번호 바꾸면 로그인 키가 같이 바뀌어서.

## 문서와 다르게 간 곳 2개 (이건 봐줘)

1. **`social_identities` / `refresh_sessions` / `password_hash` NULL / 약관 컬럼을 이번에 안 만든다.** 설계 문서 7-1은 한 번에 준비하라고 돼 있는데, 읽는 코드가 없는 스키마는 테스트로 지킬 수가 없고 git-convention의 PR 크기 기준(핵심 200줄·5파일)도 넘긴다. 각각 쓰는 PR에서 마이그레이션과 같이 넣을게.
2. **이슈 #210에 남은 요구가 설계 문서와 충돌한다.** #210은 "로그인된 사용자가 다른 identity를 명시적으로 연결", "탈퇴 시 소셜 재인증 delete grant", "Apple refresh token 암호화 저장"을 요구하는데 설계 문서 2절은 계정 연결 없음, Apple은 범위 밖이야. 문서가 더 최신이라 문서를 따른다. #210 본문은 네가 정정하는 게 맞을 것 같아.

## 다음 PR 순서 (이대로 이어서 진행)

`2` 비비디 JWT (Access 검증·Refresh 발급/회전, `@Auth`가 세션+Bearer 둘 다) → `3` 카카오 OIDC (ID Token 서명 검증, 기존 회원 로그인 / 신규 ticket 분기) → `4` 약관 동의 후 소셜 가입

참고로 실제 BE 구현 이슈는 #210인데 로거가 이 세션을 #208에 묶어놔서 PR 본문에 `Closes #208`이 박힌다. `release-be`는 기본 브랜치가 아니라 머지해도 이슈는 안 닫히니 링크로만 남아.

## 3. 사용자 · 2026-09-21T08:58:36.147Z

ㅇㅇ 그렇게 진행해

## 4. Claude · 2026-09-21T09:12:46.530Z

PR 올렸다: [woowacourse-teams/2026-bibbidi#214](https://github.com/woowacourse-teams/2026-bibbidi/pull/214) (`feature/208` → `release-be`, CI 3개 돌는 중)

## 한 일

`users.nickname`의 UNIQUE를 `users.password_login_id`로 옮겼다. 카카오 닉네임은 겹칠 수 있어서 유일성을 요구할 수 없는데, 지금 비밀번호 로그인이 닉네임으로 사용자를 찾고 있어서 제약만 떼면 로그인할 사람을 특정할 수 없었다.

- `POST /api/login`, `POST /api/users`, `GET /api/users/nickname/availability`: **요청·응답 계약 그대로**. 서버 내부 조회 대상만 바뀜. FE 수정 필요 없음
- 마이그레이션 `002_split_password_login_id_from_nickname.sql` (컬럼 추가 → 기존 닉네임 복사 → 인덱스 교체)
- `./BE/gradlew -p BE test` 409개 PASSED, `build` PASSED

**FE·팀에 알려야 할 동작 변경 하나:** `PUT /api/users/me/nickname`이 이제 표시 닉네임만 바꾸고 로그인 아이디는 가입할 때 값으로 유지한다. 닉네임 바꾼 회원은 계속 가입 때 쓰던 이름으로 로그인해야 하고, 중복 닉네임도 200으로 통과한다(409 `DUPLICATE_NICKNAME` 없어짐). PR 본문 [REQUIRED]에 올려놨다.

## 문제 하나 (봐줘야 함)

**`release-be`에서 Development Logger가 안 돈다.** `.claude/settings.json`의 hook이 전부 `node --experimental-strip-types ... cli.ts`인데 이 머신 node가 v20이라 `bad option`으로 죽는다. 레포는 Node 24를 요구하는데 설치가 안 돼 있어.

그래서 브랜치 판 시점부터 게이트가 통째로 사라졌다. 커밋 전 설명·확인, `gh pr create` 가로채기, 테스트 통과 기록, `TURN_FINISHED`·`turn-002.diff`가 전부 안 남았다. `.devlog/208/events.jsonl`에는 설계 질문과 ADR 기록까지만 있다. PR 본문과 라벨은 로거가 만들 내용대로 내가 직접 채웠다. 이 얘기는 PR 본문 Development Log 항목에도 적어놨고, 별도 작업 칩으로도 띄워놨다.

hook이 조용히 죽어도 아무 신호가 없다는 게 더 걸리는 부분이야. 게이트가 사라진 걸 아무도 모른다.

## 다음 PR

`2` 비비디 JWT (Access 검증 + Refresh 발급·회전, `@Auth`가 세션+Bearer 둘 다) → `3` 카카오 OIDC → `4` 약관 동의 후 소셜 가입. 이어서 갈까, 아니면 #214 리뷰 먼저 받을까.

여기까지가 한 단락이라 원하면 `/compact`로 컨텍스트 정리하고 다음 PR 들어가도 돼.

## 5. 사용자 · 2026-09-21T09:15:04.858Z

pr은 올리지마

취소해

## 6. Claude · 2026-09-21T09:15:34.868Z

PR #214 닫았고 세션 CI 모니터에서도 내렸다.

**지금 남아 있는 것**

| | 상태 |
|---|---|
| PR #214 | CLOSED (재오픈 가능) |
| `origin/feature/208` | 푸시된 채로 남아 있음 |
| 로컬 `feature/208` | 커밋 3개 그대로 |
| 코드 | 그대로 (테스트 409개 통과 상태) |

원격 브랜치 삭제나 커밋 되돌리기는 안 했어. 어디까지 지울지 말해주면 그대로 할게:

- **원격 브랜치도 지우기** → `git push origin --delete feature/208` (로컬 커밋은 남음)
- **커밋도 없애고 작업 내용만 남기기** → `git reset --soft origin/release-be`
- **전부 버리기** → 브랜치 삭제 + `release-be`로 복귀
- **그대로 두기** → 나중에 PR만 다시 열면 됨

그리고 확인 하나. "PR은 올리지마"가 이번 건만인지, 아니면 앞으로 내가 PR 여는 걸 아예 하지 말라는 건지. 후자면 다음 작업부터는 커밋까지만 하고 PR은 네가 직접 열도록 멈출게.

## 7. 사용자 · 2026-09-21T09:28:15.792Z

이거에 관한 이슈 만들어줘

가능하면 후행되는 이슈들도 만들어줘

## 8. Claude · 2026-09-21T09:31:09.928Z

이슈 4개 만들어서 **#210 하위**로 묶었다. 전부 `type: feature` + 마일스톤 `WEB APP 도입 및 인증 방식 변경`(마감 9/23 수요일).

```
#208 WEB APP 도입 및 인증 방식 변경
 └ #210 소셜 OIDC 및 JWT 인증 API 구체화·구현
    ├ #215 [BE] users 닉네임 유일 제약을 로그인 아이디로 분리   ← 이번에 짠 것
    ├ #216 [BE] 비비디 JWT Access·Refresh 인증 도입
    ├ #217 [BE] 카카오 OIDC 인증과 신규 회원 가입용 ticket 분기
    └ #218 [BE] 약관 동의 후 소셜 회원 가입
```

- [#215](https://github.com/woowacourse-teams/2026-bibbidi/issues/215) 본문에 닫힌 PR #214를 구현 참고로 걸어놨다. `feature/208` 브랜치에 코드가 그대로 있음
- #216 → #217 → #218은 각각 본문에 선행 이슈 번호를 박아놨다. 순서가 강제됨
- 각 이슈에 **범위에서 빼는 것** 항목을 따로 뒀다. #210 본문에 남아 있던 계정 연결·Apple·delete grant 요구가 최신 설계와 충돌해서, 하위 이슈에서 명시적으로 잘라냈다

## 두 가지 확인

**브랜치 이름.** git-convention이 `{prefix}/{issue-id}`라서 이제 `feature/208`이 아니라 `feature/215`가 맞다. 기존 브랜치 이름을 바꿔서 다시 올릴지, 아니면 그대로 둘지 알려줘.

**#210 본문.** 충돌하는 요구가 아직 그대로 남아 있다. 하위 이슈에서 잘라내긴 했지만 상위 본문도 정리하는 게 맞을 것 같은데, 이건 네가 직접 고칠지 내가 할지 정해줘.

Development Logger가 Node 24 요구해서 죽는 건 이슈로 안 만들었다. 작업 칩으로만 띄워놨는데, 그것도 `type: chore` 이슈로 올릴까?

## 9. 사용자 · 2026-09-21T09:32:43.355Z

기존에 있던 이슈들은 건들지말고 내꺼만 만들어줘

## 10. Claude · 2026-09-21T09:33:14.261Z

#210 하위 연결 4개 다 풀었다. #210은 하위 이슈 0개로 원래대로 돌아갔고, #208의 기존 하위 구조(210~213)는 손댄 적 없다.

내가 만든 이슈 4개는 독립으로 남아 있다.

| | |
|---|---|
| [#215](https://github.com/woowacourse-teams/2026-bibbidi/issues/215) | [BE] users 닉네임 유일 제약을 로그인 아이디로 분리 |
| [#216](https://github.com/woowacourse-teams/2026-bibbidi/issues/216) | [BE] 비비디 JWT Access·Refresh 인증 도입 |
| [#217](https://github.com/woowacourse-teams/2026-bibbidi/issues/217) | [BE] 카카오 OIDC 인증과 신규 회원 가입용 ticket 분기 |
| [#218](https://github.com/woowacourse-teams/2026-bibbidi/issues/218) | [BE] 약관 동의 후 소셜 회원 가입 |

#210 본문 정리 건도 안 건드린다.

남아 있는 것 두 가지 알려둘게. 지울지 말지는 네가 정해줘.

- **마일스톤** `WEB APP 도입 및 인증 방식 변경`이 네 이슈 4개에 걸려 있다. 이슈는 아니지만 공용이라 진행률 숫자가 움직여. 빼길 원하면 말해줘
- **본문 안 `상위 Issue: #210` 링크.** #210 자체를 고친 건 아닌데, 링크 때문에 #210 타임라인에 참조 알림이 남는다. 지우고 싶으면 본문에서 뺄게

## 11. 사용자 · 2026-09-21T09:34:23.563Z

그런데 지금 비밀번호 로그인은 닉네임으로 사용자를 찾습니다. 유일 제약만 떼면 같은 닉네임을 가진 사람 중 누구로 로그인시킬지 정할 수 없습니다. 그래서 소셜 로그인 구현보다 먼저, 로그인에 쓰던 식별자를 표시용 닉네임에서 떼어내야 합니다.

이거 설명이 너무 복잡하고 어려워

## 12. Claude · 2026-09-21T09:35:03.148Z

[#215](https://github.com/woowacourse-teams/2026-bibbidi/issues/215) 문제 설명 다시 썼다.

**전**
> 카카오 로그인을 붙이려면 `users.nickname`의 UNIQUE 제약을 풀어야 합니다. (...) 그런데 지금 비밀번호 로그인은 닉네임으로 사용자를 찾습니다. 유일 제약만 떼면 같은 닉네임을 가진 사람 중 누구로 로그인시킬지 정할 수 없습니다. 그래서 소셜 로그인 구현보다 먼저, 로그인에 쓰던 식별자를 표시용 닉네임에서 떼어내야 합니다.

**후**
> 지금은 닉네임이 같은 회원이 둘 있을 수 없습니다. 로그인할 때 닉네임으로 회원을 찾기 때문입니다.
>
> 카카오 로그인을 붙이면 이 규칙을 지킬 수 없습니다. 닉네임을 카카오에서 받은 그대로 쓸 건데, 카카오 닉네임이 같은 사람은 얼마든지 있습니다.
>
> 그렇다고 닉네임 중복만 열어주면 로그인이 깨집니다. "비비디"라는 회원이 둘이면 누구로 로그인시킬지 알 수 없습니다.
>
> 그래서 로그인에 쓰는 이름과 화면에 보이는 이름을 나눕니다. 로그인에는 가입할 때 정한 아이디를 쓰고, 화면에는 닉네임을 보여줍니다. 닉네임은 겹쳐도 됩니다.
>
> 카카오 로그인 작업을 시작하려면 이것부터 끝나야 합니다.

바꾼 방식은 이렇다.

- `UNIQUE 제약`, `식별자`, `표시용` 같은 말 빼고 "같은 회원이 둘 있을 수 없습니다", "로그인에 쓰는 이름 / 화면에 보이는 이름"으로
- 한 문장에 한 가지만 담고, 왜 안 되는지를 "비비디라는 회원이 둘이면" 같은 실제 상황으로
- `#210 아래 나머지 Issue` 같은 내부 참조 표현 삭제

#215 나머지(완료 조건)도 `password_login_id`, `VARCHAR(255)` 같은 게 그대로 들어가 있는데, 거긴 구현할 때 볼 체크리스트라 일부러 안 건드렸어. 거기도 풀어쓸까?

#216~#218 문제 설명도 같은 톤으로 다시 볼지 말해줘.

## 13. 사용자 · 2026-09-21T09:35:06.545Z

* 구현 참고: 닫힌 PR [[#208] users 닉네임 유일 제약을 로그인 아이디로 분리 #214](https://github.com/woowacourse-teams/2026-bibbidi/pull/214) (`feature/208` 브랜치에 코드가 있습니다)


얘는 빼줘

## 14. Claude · 2026-09-21T09:35:21.722Z

[#215](https://github.com/woowacourse-teams/2026-bibbidi/issues/215)에서 PR #214 줄 뺐다. 관련 자료는 이렇게 남았어.

- 상위 Issue: #210
- 최상위 설계 Issue: #208
- 결정 배경: 닉네임은 표시 전용이고 계정 식별·로그인 키가 아니라는 2026-09-21 소셜 로그인 설계 결정

PR #214는 여전히 닫힌 상태로 있고 `feature/208` 브랜치도 원격에 남아 있다. 이슈에서 링크만 지운 거야. 브랜치나 PR 자체를 정리하려면 말해줘.

## 15. 사용자 · 2026-09-21T09:37:37.583Z

그래서 로그인에 쓰는 이름과 화면에 보이는 이름을 나눕니다. 로그인에는 가입할 때 정한 아이디를 쓰고, 화면에는 닉네임을 보여줍니다. 닉네임은 겹쳐도 됩니다.

이 말이 무슨 말인지 모르겠네

## 16. Claude · 2026-09-21T09:38:12.859Z

고쳤다. 안 읽히던 이유는 **"가입할 때 정한 아이디"** 였던 것 같아. 지금 비비디에는 아이디라는 게 없고 가입할 때 닉네임이랑 비밀번호만 받으니까, 없던 게 갑자기 튀어나온 꼴이었다.

실제로는 새 아이디를 받는 게 아니라 **가입할 때 쓴 닉네임이 로그인용으로 복사돼서 거기 고정되는 것**이라, 그걸 그대로 적었어.

> 그래서 지금 닉네임 하나가 맡고 있는 일을 둘로 나눕니다. 하나는 로그인할 때 회원을 찾는 데 쓰고, 다른 하나는 화면에 보여주는 데만 씁니다.
>
> 가입할 때 입력한 닉네임이 두 곳에 똑같이 들어갑니다. 여기까지는 지금과 같습니다. 달라지는 건 그다음입니다. 화면에 보이는 닉네임을 나중에 바꿔도 로그인할 때 쓰는 이름은 가입할 때 값 그대로 남습니다.
>
> 예를 들어 "비비디"로 가입한 회원이 닉네임을 "예비신부"로 바꿔도 로그인은 계속 "비비디"로 합니다.
>
> 화면에 보이는 닉네임은 이제 겹쳐도 됩니다. 로그인할 때 쓰는 이름만 안 겹치면 됩니다.

여기서 제일 중요한 건 세 번째 문단이야. 기존 회원 입장에서 **닉네임을 바꿔도 로그인은 옛날 이름으로 해야 한다**는 게 이번 변경의 실제 체감 포인트고, FE도 이걸 알아야 한다. 원래 PR 본문에 [REQUIRED]로 달았던 그 내용이 이제 이슈 앞부분에 들어갔다.

이 설명이 여전히 안 맞으면 어디가 걸리는지 알려줘. 아예 다른 각도로 다시 쓸 수도 있어.

## 17. 사용자 · 2026-09-21T09:42:16.903Z

전혀 이해가 안 되는데?

무슨 말을 하고 있는 거야?

정확하게 

일반 회원가입 할 때만 닉네임 검사를 한다는 거야?


```
@GetMapping("/nickname/availability")
public NicknameAvailabilityResponse checkPasswordLoginIdAvailability(
        @Valid @ModelAttribute ChangeNicknameRequest request
) {
    boolean available = userService.isPasswordLoginIdAvailable(request.nickname());
    return new NicknameAvailabilityResponse(request.nickname(), available);
}
```

## 18. Claude · 2026-09-21T09:42:42.460Z

응, **일반 회원가입 때만.**

| 어디 | 중복 검사 |
|---|---|
| `GET /api/users/nickname/availability` (가입 화면 미리 확인) | 함 |
| `POST /api/users` (일반 회원가입) | 함, 겹치면 409 |
| `PUT /api/users/me/nickname` (닉네임 변경) | **안 함**, 겹쳐도 통과 |
| 카카오 가입 | **안 함**, 카카오가 준 닉네임 그대로 저장 |

그러니까 중복을 막는 지점은 일반 회원가입 하나뿐이야. 그 값이 그 회원의 로그인용 이름이 되니까 안 겹쳐야 하는 거고, 그 뒤에 바꾸는 닉네임은 화면에만 쓰니까 안 막는다.

내가 이슈에 길게 쓴 네 문단이 결국 이 표 한 줄씩이었어. 미안, 훨씬 돌려 말했다.

## 네가 붙인 코드

그게 내가 짠 것보다 낫다. 내 버전은 이랬어.

```java
PasswordLoginIdAvailabilityResult result =
        userService.checkPasswordLoginIdAvailability(request.nickname());
return NicknameAvailabilityResponse.from(result);
```

`PasswordLoginIdAvailabilityResult`라는 record를 하나 만들어서 `(값, boolean)`을 담아 넘기는데, 값은 컨트롤러가 이미 `request.nickname()`으로 들고 있으니 왕복시킬 이유가 없다. AGENTS.md의 "Result와 Response를 기계적으로 한 쌍씩 만들지 않는다"에 걸리는 형태고.

네 버전은 그 record가 통째로 없어진다. `isPasswordLoginIdAvailable`이 boolean만 주고 응답은 컨트롤러가 조립. 파일 하나 덜 만들고 읽기도 더 쉽다.

이걸로 바꿀까? 그러면 `PasswordLoginIdAvailabilityResult.java` 지우고 `NicknameAvailabilityResponse.from`도 같이 정리하면 돼.

## 19. 사용자 · 2026-09-21T09:44:07.946Z

중복을 막는게 아예 없어도 되는 거 아냐?

유니크가 풀리는 데

## 20. Claude · 2026-09-21T09:44:41.391Z

유니크가 풀리는 게 아니라 **자리를 옮기는 거야.**

```
전:  users.nickname          UNIQUE
후:  users.nickname          (제약 없음)
     users.password_login_id UNIQUE   ← 여기로
```

가입 화면에서 친 "닉네임"이 그대로 그 사람의 `password_login_id`가 된다. 그래서 그 값은 여전히 안 겹쳐야 해.

안 막으면 이렇게 된다.

```
회원 A: 로그인이름 "비비디", 비밀번호 aaaa
회원 B: 로그인이름 "비비디", 비밀번호 bbbb

POST /api/login  { "nickname": "비비디", "password": "aaaa" }
→ 누구?
```

지금 코드도 `findByPasswordLoginId`가 한 건만 찾게 돼 있어서 둘이 있으면 로그인이 깨진다.

## 근데 네 감은 맞아

이 검사는 **한시적**이다.

- 카카오 가입에는 애초에 없다. 카카오 닉네임은 겹쳐도 되고 식별은 `(KAKAO, sub)`가 한다
- 일반 회원가입이 없어지면 이 검사도 같이 없어진다. #210에도 "FE·KMP 검증 후 기존 로그인·세션·password_hash를 제거"라고 돼 있고, 팀원도 회의에서 [발언 비공개]

그러니까 지금 살려두는 이유는 하나야. **기존 회원이 아직 그 이름으로 로그인하고 있어서.**

## 지금 당장 없애려면

두 가지 길이 있는데 둘 다 별로다.

1. 가입에 닉네임 말고 **진짜 아이디 입력칸을 따로** 만든다 → 가입을 더 복잡하게 만드는 거라 이번 작업 방향이랑 정반대
2. 회의에서 나왔던 **`(닉네임 + 비밀번호해시)` 조합으로 로그인** → 비밀번호 바꾸면 로그인 키가 같이 바뀐다. 닉네임도 비밀번호도 똑같은 두 사람은 여전히 못 막고

그래서 그냥 두고, 일반 로그인 걷어낼 때 같이 걷어내는 게 제일 깔끔해 보여. 그때 `availability` API랑 `password_login_id` 컬럼이 한꺼번에 사라진다.

## 21. 사용자 · 2026-09-21T09:46:46.680Z

회의에서 나왔던 (닉네임 + 비밀번호해시) 조합으로 로그인 → 비밀번호 바꾸면 로그인 키가 같이 바뀐다. 닉네임도 비밀번호도 똑같은 두 사람은 여전히 못 막고

이 걸로 가야할꺼 같은데

그게 이 거야?

## 22. Claude · 2026-09-21T09:47:32.991Z

응, 그게 팀원가 회의에서 말한 거 맞아.

> `UNIQUE (nickname, password_hash)` 걸고, 로그인할 때 닉네임이랑 비밀번호 해시 둘 다로 조회

**근데 이건 지금 코드에서 동작 안 해.** 내가 아까 든 이유(비밀번호 바꾸면 키가 바뀜)보다 훨씬 앞에서 막힌다.

## Argon2 해시에 매번 다른 salt가 들어간다

[Argon2PasswordHasher.java:9](BE/src/main/java/com/bibbidi/wedding/auth/password/Argon2PasswordHasher.java:9)

```java
private static final int SALT_LENGTH = 16;
```

테스트 픽스처에 박혀 있는 실제 해시를 뜯어보면 이렇다.

```
$argon2id$v=19$m=19456,t=2,p=1$mPT6Y0wsuHrmDa2H/HbqZQ$mA8UYY3PjaR5MI3uemA0Ko...
                               └──── salt ────┘ └──── 해시 ────┘
```

salt가 해시 문자열 **안에** 들어 있다. 그래서 같은 비밀번호 `wish`를 두 번 저장하면 완전히 다른 문자열이 나온다.

여기서 두 가지가 동시에 깨진다.

**1. 조회가 불가능하다.** `WHERE nickname = ? AND password_hash = ?`를 하려면 해시를 먼저 만들어야 하는데, 해시를 만들려면 salt가 필요하고, salt는 그 row 안에 있다. row를 읽어야 row를 찾을 수 있는 꼴이야.

지금 `matches(raw, storedHash)`가 되는 이유가 바로 이거다. 저장된 문자열에서 salt를 꺼내 쓰거든. 조회에는 그 방법을 못 쓴다.

**2. UNIQUE가 아무것도 안 막는다.** 닉네임도 비밀번호도 똑같은 두 사람이 가입해도 salt가 달라서 해시가 다르다. 제약이 걸려도 안 걸리는 거랑 같아.

이걸 굴리려면 salt를 빼고 결정적 해시(같은 입력 → 항상 같은 출력)로 바꿔야 하는데, 그건 레인보우 테이블에 그대로 노출되는 거라 보안이 크게 후퇴한다.

## 그래서 `password_login_id`가 뭐였냐면

네가 새 컬럼 만드는 게 걸리는 거면, 이렇게 보면 될 것 같아.

> **"닉네임인데, 비밀번호로 로그인하는 사람들끼리만 안 겹치게"**

이걸 그대로 SQL로 쓰면 `UNIQUE (nickname) WHERE password_hash IS NOT NULL`인데 MySQL에는 조건부 유니크가 없다. 그래서 그 조건을 컬럼 하나로 만들어 둔 게 `password_login_id`야. 소셜 회원은 NULL이고, MySQL UNIQUE는 NULL을 여러 개 허용하니까 자동으로 검사 대상에서 빠진다.

---

그래도 조합 유니크로 가보고 싶으면, 해시 방식을 바꾸는 것까지 같이 가야 해. 그건 별도로 논의할 만한 주제고, 내가 임의로 정할 건 아닌 것 같아서 여기서 멈출게. 어떻게 할까?

## 23. 사용자 · 2026-09-21T09:50:05.414Z

password_login_id

그러니깐 얘가 정확히 뭔데?

닉네임이라는 거야?

## 24. Claude · 2026-09-21T09:50:24.274Z

**가입할 때 친 닉네임을 복사해서 고정해 둔 값이야.** 로그인할 때만 쓴다.

값 자체는 닉네임 맞아. 가입 직후엔 두 컬럼이 글자 하나 안 틀리고 똑같다.

```
"비비디" / wish 로 가입

id  nickname   password_login_id   password_hash
1   비비디      비비디               $argon2id$...
```

갈라지는 건 닉네임을 바꿀 때다.

```
닉네임을 "예비신부"로 변경

id  nickname   password_login_id   password_hash
1   예비신부    비비디               $argon2id$...
            ↑ 바뀜    ↑ 그대로
```

로그인은 오른쪽 컬럼으로 한다.

```
POST /api/login  { "nickname": "비비디", "password": "wish" }   → 성공
POST /api/login  { "nickname": "예비신부", "password": "wish" } → 401
```

그리고 나중에 카카오 회원이 들어오면 (#218) 이 컬럼이 비어 있다. 카카오 회원은 비밀번호 로그인을 안 하니까.

```
id  nickname   password_login_id   password_hash
2   민수        NULL                NULL
```

정리하면 차이는 두 개뿐이야.

| | nickname | password_login_id |
|---|---|---|
| 바뀌나 | 바뀜 | 가입할 때 값으로 고정 |
| 겹쳐도 되나 | 됨 | 안 됨 |

---

혹시 계속 안 잡히는 게 **이름** 때문이면 그게 맞는 지적일 수도 있어. `password_login_id`라고 써놓으니까 "아이디"라는 새 개념처럼 읽히는데, 실제로는 가입 때 닉네임이 그대로 굳은 거거든. `login_nickname`이나 `signup_nickname` 같은 게 더 정직할 수도 있다. 이름부터 다시 볼까?

## 25. 사용자 · 2026-09-21T09:51:17.665Z

signup_nickname 이게 더 나은 거 같은데?

## 26. Claude · 2026-09-21T09:51:45.918Z

`signup_nickname`이 낫다. 동의. "아이디"라는 없던 개념을 만들지 않고, 값이 어디서 왔는지가 이름에 그대로 있다.

한 가지만 미리 말해두면, 이 이름은 값의 **출처**를 말하지 **역할**(로그인 키)은 말하지 않아. 소셜 회원도 가입은 하는데 이 컬럼이 NULL인 게 살짝 걸리는 정도. 그래도 "아이디"보다 훨씬 덜 헷갈릴 것 같아서 그대로 간다.

이름 `signup_nickname`으로 전부 바꿨다. 로컬 커밋까지 했고 **푸시는 안 했어.**

## 코드

18개 파일에서 컬럼·필드·메서드명 교체. 테스트 409개 + `build` 통과.

```
users.password_login_id      → users.signup_nickname
uk_users_password_login_id   → uk_users_signup_nickname
User.passwordLoginId         → User.signupNickname
findByPasswordLoginId        → findBySignupNickname
isPasswordLoginIdAvailable   → isSignupNicknameAvailable
002_split_password_login_id_from_nickname.sql
  → 002_add_signup_nickname_and_drop_nickname_unique.sql
```

네가 작업 트리에 이미 고쳐놓은 것(`PasswordLoginIdAvailabilityResult` 삭제 + 컨트롤러에서 바로 조립)도 그대로 살려서 같이 커밋했다. 그게 더 낫다는 거 아까 얘기한 그대로고.

한글 표현도 "로그인 아이디" → "가입 닉네임"으로 바꿨는데, 단순 치환이라 조사가 다 깨져서(`가입 닉네임는`, `가입 닉네임와`) 따로 손봤다. "아이디"는 받침이 없고 "닉네임"은 있어서.

## 이슈

[#215](https://github.com/woowacourse-teams/2026-bibbidi/issues/215) 제목도 바꿨다.

- 전: `[BE] users 닉네임 유일 제약을 로그인 아이디로 분리`
- 후: `[BE] 로그인에 쓰는 닉네임과 화면에 보이는 닉네임 분리`

완료 조건도 `signup_nickname` 기준으로 다시 썼어. #216~#218은 이 이름을 안 쓰니까 안 건드렸다.

## 커밋 상태

```
3cc5b94 refactor: 로그인 식별자 이름을 signup_nickname으로 바꾼다   ← 방금
5b1345a chore: 개발 작업 기록 추가
68d8e98 feat: 비밀번호 로그인과 중복 확인을 로그인 아이디로 조회한다
c1b9d69 feat: users 테이블에 로그인 아이디를 두고 닉네임 유일 제약을 제거한다
```

아래 3개 메시지에 아직 옛날 말("로그인 아이디")이 남아 있다. 어차피 squash merge라 트렁크엔 PR 제목만 남지만, 신경 쓰이면 4개를 하나로 합쳐서 정리할게. 그리고 브랜치 이름도 지금 `feature/208`인데 이슈가 #215로 생겼으니 `feature/215`가 맞아.

정리할까, 이대로 둘까?

## 27. 사용자 · 2026-09-21T09:57:27.283Z

그리고 서비스에 있는 트라이 캐치 레포지토리 쪽으로 넘겨줘

dupicated 뭐 이런 db 예외가 서비스 레이어까지 내려올 필요가 없는 거 같아

## 28. Claude · 2026-09-21T09:59:33.481Z

옮겼다. 테스트 통과, `build` 통과. 로컬 커밋만 했고 푸시는 안 했어.

**UserRepository.create** (여기서 번역)
```java
public User create(User user) {
    try {
        JpaUserEntity saved = jpaUserRepository.saveAndFlush(userMapper.toEntity(user));

        return userMapper.toDomain(saved);
    } catch (DataIntegrityViolationException exception) {
        throw new BusinessException(
                DUPLICATE_NICKNAME,
                DUPLICATE_SIGNUP_NICKNAME_MESSAGE + user.signupNickname()
        );
    }
}
```

**UserService.createUser** (try/catch 사라짐)
```java
@Transactional
public UserResult createUser(String nickname, String passwordHash) {
    String signupNickname = nickname;
    User user = new User(null, nickname, signupNickname, passwordHash);
    User savedUser = userRepository.create(user);

    return UserResult.from(savedUser);
}
```

`UserService`에서 `DataIntegrityViolationException`, `BusinessException`, `ClientError` import 세 개가 통째로 빠졌다. 이제 이 클래스는 스프링 DAO 예외를 아예 모른다.

## 테스트도 계층 따라 옮겼다

test-strategy.md가 "같은 규칙을 여러 계층에서 중복 검증하지 않는다"라서 서비스 쪽 중복 테스트는 지우고 레포지토리 테스트가 받게 했다.

- `UserServiceTest`: `shouldRejectRegistrationWhenNicknameIsAlreadyTaken` 삭제 (mock으로 DB 예외를 흉내내던 테스트였음)
- `UserRepositoryIntegrationTest`: 중복 저장 시 기대값을 `DataIntegrityViolationException` → `BusinessException` + `DUPLICATE_NICKNAME`으로

`UserServiceConcurrencyIntegrationTest`는 원래 `BusinessException`을 잡고 있어서 그대로 통과했다.

## 하나 짚어둘 것

`ChecklistRepository`가 이미 똑같이 하고 있더라. `DUPLICATE_CHECKLIST`, `DUPLICATE_CHECKLIST_ITEM` 전부 레포지토리에서 번역한다. 메시지 상수 빼두는 방식까지 거기 맞췄어. **`UserService`만 혼자 예외였던 거야.**

다만 `create`가 잡는 `DataIntegrityViolationException`을 전부 `DUPLICATE_NICKNAME`으로 단정한다. 지금 `users`에 UNIQUE가 `uk_users_signup_nickname` 하나뿐이라 맞는데, #218에서 `social_identities` 붙고 제약이 늘면 그때 다시 봐야 한다. `ChecklistRepository`도 같은 방식이라 일단 맞췄어.

## 29. 사용자 · 2026-09-21T10:01:23.689Z

나 근데 궁금한게

login 에서 

닉네임을 바꾼다고 치면

바꾼 닉네임으로 login을 하는 건 맞지?

그리고 회원가입 할 때 

기존의 회원의 닉네임에 대한 유니크를

현재 가지고 있는 닉네임이 아니라 signup_nickname로 하는거야?

뭔가 엉킨 거 같은데?

## 30. Claude · 2026-09-21T10:02:14.063Z

엉킨 거 맞아. 두 질문 다 짚은 지점이 정확하다.

## 1. 지금 구현은 **옛날 닉네임으로** 로그인한다

네 기대랑 반대야.

```
가입    nickname="철수"  signup_nickname="철수"
닉변    nickname="영희"  signup_nickname="철수"   ← 안 바뀜

POST /api/login {"nickname":"영희"} → 401
POST /api/login {"nickname":"철수"} → 200
```

테스트에도 그렇게 박아놨다. [UserControllerIntegrationTest.java:354](BE/src/test/java/com/bibbidi/wedding/user/controller/UserControllerIntegrationTest.java:354)

## 2. 그래서 가입 중복 검사가 이상해진다

```
A:  nickname="영희"  signup_nickname="철수"

새 회원이 "철수"로 가입 시도 → 거절
근데 화면 어디에도 "철수"는 없다
```

**안 보이는 값으로 막는 거야.** "이미 사용 중인 닉네임입니다"라고 응답하는데, 정작 그 닉네임을 쓰는 사람이 화면엔 없다. 설명할 방법이 없다.

내가 이슈에 "닉네임을 바꿔도 로그인은 가입할 때 이름으로"라고 당연한 듯 써놨는데, 그게 당연한 게 아니었다. 설계 문서도 여기까지는 안 정해놨어.

## 길은 두 개

**A. 지금 것 (가입 때 값으로 고정)**
- 닉변해도 로그인 안 깨짐
- 대신 위의 두 문제 그대로

**B. 닉네임 바꾸면 그 값도 같이 바꾼다**
- 바꾼 닉네임으로 로그인 ✓ (네 기대)
- 중복 검사가 화면에 보이는 값과 비교 ✓
- 대신 닉네임 변경할 때 중복 검사가 **다시 필요**하다

B의 "중복 검사가 다시 필요"가 걸릴 것 같은데, 실제로는 이렇게 갈린다.

| | 일반 회원 | 카카오 회원 |
|---|---|---|
| 그 컬럼 | 값 있음 | NULL |
| 닉네임 중복 | 안 됨 | 됨 |

카카오 회원은 NULL이라 UNIQUE 검사에서 자동으로 빠진다. 그러니까 **일반 회원끼리만 못 겹치고, 이건 지금이랑 똑같다.** 원래 목표가 "카카오 닉네임이 겹쳐도 되게"였지 "일반 회원 닉네임도 겹치게"는 아니었잖아.

---

**B를 추천해.** 기존 회원 입장에서 달라지는 게 하나도 없고, 카카오 회원만 새 규칙이 적용된다. A는 기존 회원한테 "닉네임 바꿨는데 로그인은 옛날 걸로" 같은 설명 불가능한 동작을 강요한다.

B로 가면 `signup_nickname`이란 이름은 또 틀려져. 가입 때 값이 아니라 현재 로그인에 쓰는 값이니까 `login_nickname`이 맞다.

B로 갈까? 그러면 닉네임 변경에 중복 검사 되살리고, 컬럼명 다시 바꾸고, 이슈 #215도 고칠게.

## 31. 사용자 · 2026-09-21T10:11:32.131Z

전제 조건을 말을 못했는데

일반 회원가입이랑 로그인도 없어지는 걸로 할꺼야

수요일 배포시에 일반 로그인 덜어내고 

소셜 로그인으로만 할 수 있도록

## 32. Claude · 2026-09-21T10:12:17.021Z

그러면 **`signup_nickname`이 통째로 필요 없어져.**

그게 있는 이유가 하나뿐이었거든. "닉네임 UNIQUE를 푸는데 비밀번호 로그인은 계속 닉네임으로 사람을 찾아야 한다"는 상황을 버티는 것. 비밀번호 로그인이 없어지면 닉네임으로 사람을 찾는 코드가 아예 사라진다. 그럼 `users.nickname`에서 UNIQUE만 떼면 끝이야. 컬럼 추가도, 값 복사도, 중복 확인 API도 다 필요 없다.

## 근데 딱 하나에 걸린다

**소셜 로그인 배포와 일반 로그인 제거가 같은 배포야?**

- **같은 배포면** → `signup_nickname` 버린다. #215는 `ALTER TABLE users DROP INDEX nickname` 수준으로 쪼그라든다
- **며칠이라도 겹치면** → 필요하다. 그 기간에 카카오 회원이 들어오면서 닉네임이 겹치는데 비밀번호 로그인이 아직 살아 있으면 로그인이 깨진다

#210 본문에는 "기존 세션 API와 짧게 병행한 뒤 FE·KMP 검증 후 제거"라고 돼 있어서 나는 겹친다고 보고 짰어. 수요일에 같이 덜어내는 거면 전제가 달라진다.

## 그리고 이건 꼭 확인해야 할 것 같은데

**기존 비밀번호 회원들은 어떻게 돼?**

설계 문서가 "계정 연결 없음, 같은 사람이어도 별도 `users.id`"라서, 일반 로그인을 덜어내면 그 사람들은 **로그인할 방법이 사라지고 체크리스트도 같이 못 보게 된다.** 카카오로 새로 가입해도 완전히 다른 계정이야.

회의에서 수집 데이터 품질 문제 [비공개].

## 없어지는 범위 (내가 파악한 것)

```
POST   /api/users                      회원가입
POST   /api/login                       로그인
DELETE /api/logout                      로그아웃
PUT    /api/users/me/password           비밀번호 변경
GET    /api/users/nickname/availability 닉네임 중복 확인
DELETE /api/users/me                    탈퇴 (비밀번호 요구 → 다른 방식 필요)

auth/password/*   Argon2PasswordHasher, PasswordHasher, ValidPassword
auth/session/*    5개 파일 전부
users.password_hash
```

탈퇴만 애매하다. 지금 비밀번호로 본인 확인을 하는데 그게 없어지면 뭘로 확인할지 정해야 해. #210은 "소셜 재인증 delete grant"라고 적어놨는데 설계 문서엔 없는 얘기고.

---

위 두 개(겹치는 기간 / 기존 회원 데이터) 답 주면 이슈 다시 짤게. 겹치는 기간이 없다면 #215는 내용이 거의 다 날아가고, 대신 "일반 회원가입·로그인 제거" 이슈가 새로 필요해 보인다.

`signup_nickname` 작업은 일단 그대로 둘게. 답 듣고 정리하는 게 맞을 것 같아서.

## 33. 사용자 · 2026-09-21T10:14:38.787Z

근데

하나 더 추가된 게 있는데

기존 사용자가 N명 있거든?

그 분들을 위해서 일단 로그인은 남겨두고

소셜 로그인을 붙일 수 있는 기능까지 수요일 배포

이렇게까지 정리하자

## 34. Claude · 2026-09-21T10:15:17.402Z

전제가 또 뒤집혔는데, 이번 건 방향이 명확해서 정리부터 할게.

**`signup_nickname`은 이제 확실히 필요하다.** 일반 로그인이 남으면 닉네임으로 사람을 찾는 경로가 살아 있고, 동시에 카카오 회원이 들어오면서 닉네임이 겹친다. 둘이 공존하려면 로그인 키를 닉네임에서 떼야 해. 지금 작업 그대로 간다.

**계정 연결은 설계 문서를 뒤집는 결정이야.** 문서 2절에 "계정 연결 없음, 한 비비디 계정에 여러 소셜을 붙이는 기능도 이번 범위에 없다"라고 박혀 있는데, 이게 이번에 들어가면 그 문장이 무효가 된다. 오히려 #210에 적혀 있던 "로그인된 사용자가 명시적으로 다른 identity를 연결"이 맞는 요구가 되는 거고. 아까 내가 "#210이 낡았다"고 한 건 틀렸다.

두 가지만 정해주면 이슈 다시 짤게.

정리됐다. 이슈 다시 짜기 전에 하나만 짚을게.

**닉네임 변경이 로그인 키를 바꾸냐(아까 A/B)는 이제 A가 맞아 보인다.** 아까는 B를 추천했는데 전제가 바뀌었어. 소셜 회원은 `signup_nickname`이 NULL이라 B로 하면 "값이 있으면 같이 바꾸고 없으면 그대로" 분기가 생긴다. 게다가 일반 로그인은 해당 사용자들이 카카오를 붙이기 전까지만 쓰는 과도기고, 붙이고 나면 카카오로 로그인하니까 "옛 닉네임으로 로그인" 문제도 같이 사라진다. 분기 없이 `nickname`만 바꾸는 쪽으로 간다.

정리 끝. 수요일 배포용 BE 이슈 5개다.

| | | 선행 |
|---|---|---|
| [#215](https://github.com/woowacourse-teams/2026-bibbidi/issues/215) | 일반 회원가입을 닫고 닉네임 유일 제약 제거 | - |
| [#216](https://github.com/woowacourse-teams/2026-bibbidi/issues/216) | 비비디 JWT Access·Refresh 인증 도입 | #215 |
| [#217](https://github.com/woowacourse-teams/2026-bibbidi/issues/217) | 카카오 OIDC 인증과 신규 회원 가입용 ticket 분기 | #216 |
| [#218](https://github.com/woowacourse-teams/2026-bibbidi/issues/218) | 약관 동의 후 소셜 회원 가입 | #217 |
| [#219](https://github.com/woowacourse-teams/2026-bibbidi/issues/219) | 기존 계정에 카카오 계정 연결 | #217 |

**#215가 바뀐 부분**: `POST /api/users`와 `GET /api/users/nickname/availability` 삭제가 들어갔다. 회원가입이 없으면 중복을 확인할 대상이 없으니 같이 나간다. `signup_nickname`은 기존 두 명 값만 채워지고 그 뒤로 안 늘어난다.

**#217에서 고친 것**: "계정 연결 안 함"이라고 적어뒀던 걸 "#219에서 다룸"으로 바꿨다. 대신 "닉네임·이메일이 같다고 자동으로 합치지 않는다"는 남겼어. 자동 병합은 여전히 안 하는 게 맞으니까.

**#219는 설계 문서를 뒤집는 결정**이라 본문에 그렇게 적어놨다. 나중에 왜 이렇게 했는지 추적되게.

## 코드 쪽에서 남은 일

지금 로컬 `feature/208` 브랜치는 **회원가입이 살아 있는 버전**이야. #215가 바뀌었으니 이것도 따라가야 한다.

```
삭제:  POST /api/users, GET /api/users/nickname/availability
       AuthService.register, UserService.createUser
       UserService.isSignupNicknameAvailable
       CreateUserRequest/Response, NicknameAvailabilityResponse
       UserRepository.existsBySignupNickname
```

하나 걸리는 게 있는데, `UserControllerIntegrationTest`가 `POST /api/users`로 테스트 데이터를 만들고 있다. 그게 없어지면 `@Sql` 픽스처로 바꿔야 해서 통합 테스트 손볼 게 좀 된다. test-strategy.md도 "준비 API가 없는 경우에는 `@Sql`로 적재한다"고 돼 있으니 방향은 맞아.

이어서 이 정리까지 할까? 브랜치 이름도 `feature/215`로 바꾸는 게 맞고.

## 35. 사용자 · 2026-09-21T10:18:44.220Z

ㅇㅇ 브랜치 이름도 feature/215로 바꾸고 정리해줘

그리고 api는 살려줘 없애진 마 혹시 모르니깐

## 36. 사용자 · 2026-09-21T10:19:20.040Z

api를 막을 방법이 있나?

그냥 문서에서만 빼면 되려나?

## 37. Claude · 2026-09-21T10:20:04.485Z

막을 방법은 있는데, 가격이 셋 다 달라.

## 1. 문서에서만 빼기 (제일 쌈)

`openapi3.yaml`은 통합 테스트의 `document(...)` 호출에서 만들어진다. 그거 7개를 걷어내면 Swagger UI에서 사라진다.

```
RegistrationControllerIntegrationTest   users-create 외 4개
UserControllerIntegrationTest           users-nickname-availability 외 2개
```

테스트 자체는 그대로 돌아서 동작 검증은 유지된다. **대신 엔드포인트는 열려 있다.** 경로 아는 사람은 그냥 호출된다.

되살릴 때도 `document(...)` 다시 넣고 배포하면 끝이라 회수도 싸.

## 2. 프로퍼티로 끄기 (진짜 스위치)

`createUser`랑 `checkSignupNicknameAvailability`를 별도 컨트롤러로 빼고 거기에 `@ConditionalOnProperty`를 건다.

```java
@ConditionalOnProperty(name = "bibbidi.password-signup.enabled", havingValue = "true")
@RestController
public class PasswordSignUpController { ... }
```

빈이 안 올라가면 핸들러 매핑 자체가 없어서 404. 되살릴 땐 환경변수 켜고 재시작만 하면 되고 빌드·배포가 필요 없다. **"혹시 모르니깐"에 가장 정직하게 맞는 답이야.**

근데 비용이 아까 내가 말한 삭제랑 거의 같다. `UserControllerIntegrationTest`를 비롯한 여러 통합 테스트가 `POST /api/users`로 픽스처를 만들고 있어서, 그 테스트들에 프로퍼티를 켜주거나 `@Sql`로 갈아야 해. 그게 이 작업의 대부분이다.

## 3. 인프라에서 막기

`Infra/` nginx에서 그 두 경로만 막는다. 애플리케이션 코드는 손도 안 댄다. 근데 로컬·개발 서버는 그대로 열려 있고, BE 코드만 보는 사람은 막혀 있다는 걸 모른다.

---

**수요일까지면 1번을 추천해.** 사용자 N명짜리 서비스에서 "발견되지 않는 것"이 실질적으로 충분하고, 지금 시간을 써야 할 곳은 #216~#219다. 2번은 쓸 시간이 아까워.

다만 1번이 막는 게 아니라는 건 분명히 알고 가야 해. 누가 경로를 알면 가입된다. 그게 걸리면 2번으로 가고, 그럼 오늘 #215에 반나절은 더 붙는다.

어느 쪽으로 갈까?

참고로 브랜치는 `feature/215`로 바꿔서 푸시해놨다. `origin/feature/208`은 아직 남아 있는데(PR #214가 닫힌 채로 물려 있음) 지울지 말지는 말해줘.

## 38. 사용자 · 2026-09-21T10:20:38.653Z

1번으로 가고 origin/feature/208도 지워줘

## 39. Claude · 2026-09-21T10:23:06.660Z

문서에서 빠진 것 확인했다. `openapi3.yaml`에 `POST /api/users`와 `/api/users/nickname/availability`가 없다. 엔드포인트는 살아 있고 동작 검증 테스트도 그대로다. 이제 커밋 내역 정리할게.

다 정리했다.

## 커밋 내역

```
53787a4  chore: 개발 작업 기록 추가                              ← .devlog 한 커밋
e00c161  docs: 일반 회원가입과 닉네임 중복 확인을 API 문서에서 뺀다
31e4476  feat: 로그인에 쓰는 닉네임을 가입 닉네임으로 분리한다
```

5개 → 3개로 합쳤다. 중간에 끼어 있던 `chore: 개발 작업 기록 추가`를 맨 뒤로 빼서 **작업 기록은 PR 직전 한 커밋에** 몰았고, "로그인 아이디"라고 쓰여 있던 옛 메시지도 다 없어졌다. `feature/215`에 force push 했어(`origin/feature/208`은 삭제 완료).

리셋 전후로 `BE/` 트리가 동일한 것 확인했다. 내용은 안 바뀌고 커밋 경계만 다시 그은 거야.

## API 막기 (1번)

`document(...)` 7개를 걷어냈다.

```
users-create, users-create-invalid-request,
users-create-empty-nickname-and-too-long-password, users-create-nickname-conflict
users-nickname-availability, -taken, -invalid-request
```

빌드해서 `openapi3.yaml` 확인했더니 `POST /api/users`랑 `/api/users/nickname/availability`가 사라졌다. 남아 있는 경로는 `/api/login`, `/api/logout`, `/api/users/me*` 뿐이야.

동작 검증 `andExpect`는 하나도 안 건드렸다. 테스트는 그대로 돌아서 회원가입이 깨지면 여전히 잡힌다. 되살릴 땐 `document(...)` 다시 넣으면 끝.

**다시 말하지만 이건 막는 게 아니라 안 보이게 하는 거다.** 경로를 아는 사람은 그대로 `POST /api/users` 호출된다.

## 이슈

[#215](https://github.com/woowacourse-teams/2026-bibbidi/issues/215) 제목과 본문을 지금 코드에 맞췄다.

- 제목: `[BE] 로그인에 쓰는 닉네임을 가입 닉네임으로 분리`
- "API 삭제" 조건을 빼고 "문서에서만 뺀다"로 교체
- Repository 예외 번역 조건 추가
- 검증 방법에 `openapi3.yaml` 확인 추가

#216~#219는 이번 변경과 무관해서 안 건드렸다.

---

테스트 409개 + `build` 통과. 워킹 트리 깨끗하다. `.devlog`는 로거가 `208`로 묶어놔서 `.devlog/208/` 경로 그대로 뒀어. 이슈가 #215로 바뀌었지만 로거가 쓴 기록이라 내가 임의로 옮기진 않았다.

PR은 네가 올리라고 할 때 올릴게.

## 40. 사용자 · 2026-09-21T10:25:17.184Z

ㅇㅏ니 signupNickname 자체가 필요 없다니깐

## 41. Claude · 2026-09-21T10:26:00.044Z

맞다. 네 말이 맞고 내가 계속 틀린 전제를 붙들고 있었다.

`signup_nickname`은 **일반 회원이 계속 늘어난다**는 전제에서만 필요하다. 회원가입을 닫고 기존 회원이 N명으로 고정되면, 비밀번호로 로그인하는 사람은 영원히 그 N명뿐이다. 그럼 컬럼을 새로 팔 이유가 없다.

로그인 조회에 조건 하나만 더 붙이면 된다.

```
WHERE nickname = ? AND password_hash IS NOT NULL
```

카카오 회원은 `password_hash`가 NULL이라 조회 대상에서 자동으로 빠진다. 닉네임이 겹쳐도 로그인은 안 깨진다. `users.nickname`에서 UNIQUE만 떼면 끝이고 마이그레이션도 두 줄이다.

걷어낼게.

컬럼은 걷어냈다. 코드가 훨씬 작아졌어.

```
변경 파일 8개 (전: 24개)
users.signup_nickname 없음, 값 복사 없음
마이그레이션:  ALTER TABLE users DROP INDEX nickname, MODIFY COLUMN nickname VARCHAR(255) NOT NULL;
로그인 조회:   findByNicknameIgnoreCaseAndPasswordHashIsNotNull
```

**그런데 테스트 2개가 깨졌고, 이게 진짜 문제를 하나 드러냈다.**

```
UserServiceConcurrencyIntegrationTest
  같은 닉네임의 회원가입 요청이 동시에 와도 한 명만 가입시킨다        FAILED
  서로 다른 사용자가 같은 닉네임으로 동시에 변경해도 한 명만 변경시킨다  FAILED

  Expecting actual: [true, true]
  to contain exactly in any order: [true, false]
```

둘 다 성공해버린다. 지금까지는 **DB의 UNIQUE가 경합을 막고 있었다.** 그걸 떼면 애플리케이션 `if (exists...)` 가 대신하는데, 검사하고 저장하는 사이에 틈이 있어서 동시 요청 둘 다 통과한다.

이건 컬럼을 없앤 대가가 아니라 **"닉네임 중복 허용"의 대가**야. 카카오 닉네임이 겹칠 수 있는 이상 `UNIQUE(nickname)`은 못 쓴다. 되살리는 유일한 방법이 별도 컬럼(= `signup_nickname`)이고, 그건 네가 안 쓰기로 한 거고.

## 그래서 제안

**이 PR에서 UNIQUE를 아예 떼지 말자.**

지금 떼서 얻는 게 없다. 카카오 회원이 들어오기 전까지 닉네임이 겹칠 일 자체가 없으니까. 오늘 기준으로 이 변경은 **동작을 하나도 안 바꾸고 방어막만 하나 없앤다.**

| | 지금 떼기 | #218에서 떼기 |
|---|---|---|
| 오늘 달라지는 동작 | 없음 | 없음 |
| 동시성 방어 | 지금부터 사라짐 | 필요해질 때 사라짐 |
| 동시성 테스트 2개 | 지워야 함 | 그때 같이 판단 |

`password_hash IS NOT NULL` 조건도 마찬가지다. 소셜 회원이 없으면 전원이 해당돼서 아무 일도 안 한다.

그러면 **#215는 내용이 없어진다.** 닫고 #218(약관 동의 후 소셜 가입)에 합치는 게 맞아 보여. 스키마·로그인 조회·닉네임 규칙을 카카오 가입이 실제로 들어오는 자리에서 한 번에 정하는 거지.

---

어떻게 할까?

- **A** 지금 떼고 동시성 테스트 2개 지운다. #215 유지
- **B** #215 닫고 #218에 합친다. 브랜치는 버린다 ← 추천

B면 오늘 BE에서 나온 산출물은 이슈 5개와 여기서 정리된 설계뿐이야. 코드는 안 남는다. 그래도 그게 맞다고 봐. 지금 브랜치는 테스트 2개가 깨진 상태로 있고, 그걸 초록으로 만들려면 방어막을 지우는 것 말고 방법이 없어.

## 42. 사용자 · 2026-09-21T10:30:50.552Z

테스트를 버려



그리고 팀원 코드 리팩토링도 넣으라고 


```
"이미 사용 중인 닉네임입니다. nickname=" + nickname
```

이 딴거

## 43. Claude · 2026-09-21T10:34:58.445Z

`signup_nickname` 걷어냈다. 테스트 통과, 빌드 통과, `feature/215`에 force push 완료.

## 컬럼 대신 조건 하나

```java
// JpaUserRepository
Optional<JpaUserEntity> findByNicknameIgnoreCaseAndPasswordHashIsNotNull(String nickname);
boolean existsByNicknameIgnoreCaseAndPasswordHashIsNotNull(String nickname);
boolean existsByNicknameIgnoreCaseAndIdNotAndPasswordHashIsNotNull(String nickname, Long id);
```

마이그레이션도 이걸로 끝이다.

```sql
ALTER TABLE users
    DROP INDEX nickname,
    MODIFY COLUMN nickname VARCHAR(255) NOT NULL;
```

**변경 파일 24개 → 14개.** `User` 도메인은 아예 안 건드렸고, 오늘 기준 겉으로 드러나는 동작 변화도 없다(소셜 회원이 없으니 전원이 `password_hash IS NOT NULL`이라 기존과 똑같이 움직인다).

## 버린 테스트

```
UserServiceConcurrencyIntegrationTest  (파일 통째로 삭제)
  같은 닉네임의 회원가입 요청이 동시에 와도 한 명만 가입시킨다
  서로 다른 사용자가 같은 닉네임으로 동시에 변경해도 한 명만 변경시킨다
```

DB UNIQUE가 막아주던 걸 서비스 `if`가 대신하면서 동시 요청은 못 막는다. 같은 닉네임으로 동시에 가입하면 둘 다 저장되고 그 뒤 두 계정 다 로그인이 실패한다. 이슈 본문에 **감수하는 것** 항목을 따로 만들어 적어놨다. 나중에 왜 테스트가 없어졌는지 추적되게.

## 메시지 상수 리팩토링

말한 그거 맞다면 이렇게 뺐어. 중복 리터럴 3종.

```java
// UserService
private static final String DUPLICATE_NICKNAME_MESSAGE = "이미 사용 중인 닉네임입니다. nickname=";

// AuthService
private static final String AUTHENTICATION_FAILED_MESSAGE = "로그인 인증에 실패했습니다.";
private static final String PASSWORD_VERIFICATION_FAILED_MESSAGE = "현재 비밀번호 검증에 실패했습니다. userId=";

// UserRepository
private static final String USER_NOT_FOUND_MESSAGE = "제공받은 아이디를 기반으로 회원을 찾을 수 없습니다. userId=";
```

`ChecklistRepository`가 이미 이 방식이라 거기 맞췄다. 마지막 건 원래 `"...찾을 수 없습니다." + userId`라 로그에 `습니다.12`처럼 붙어 나왔는데 `userId=`를 넣어 고쳤어. 응답 본문에는 `ClientError` 문구가 나가니까 클라이언트 계약은 안 바뀐다.

"팀원"가 사람 이름이었으면 잘못 짚은 거니까 말해줘.

## 커밋

```
fc13e1f  chore: 개발 작업 기록 추가
9486aef  docs: 일반 회원가입과 닉네임 중복 확인을 API 문서에서 뺀다
c11323f  refactor: 중복되는 예외 메시지를 상수로 뺀다
983feaa  feat: 닉네임 유일 제약을 제거하고 비밀번호 로그인 회원만 닉네임으로 찾는다
```

[#215](https://github.com/woowacourse-teams/2026-bibbidi/issues/215) 제목·본문도 이 설계로 다시 썼다. PR은 말하면 올릴게.

## 44. 사용자 · 2026-09-21T10:39:07.625Z

이슈 최신화해줘

## 45. Claude · 2026-09-21T10:40:22.709Z

이슈 최신화했다. 이번 대화에서 바뀐 전제를 반영한 건 세 개다.

| | 바뀐 것 |
|---|---|
| [#215](https://github.com/woowacourse-teams/2026-bibbidi/issues/215) | `signup_nickname` 삭제 → `password_hash IS NOT NULL` 조건으로. **감수하는 것** 항목 신설(동시성 보장 상실 + 테스트 삭제 이유). 회원가입 API는 문서에서만 제외 |
| [#216](https://github.com/woowacourse-teams/2026-bibbidi/issues/216) | 기존 회원 N명의 JSESSIONID 세션 로그인이 그대로 동작해야 한다는 완료 조건 추가 |
| [#218](https://github.com/woowacourse-teams/2026-bibbidi/issues/218) | `password_hash`가 비는 회원이 여기서 처음 생기고, #215가 그걸 미리 받쳐둔 구조라는 설명 추가. 카카오 닉네임이 기존 회원과 겹쳐도 가입을 막지 않는다는 조건과 회귀 테스트 추가 |

[#217](https://github.com/woowacourse-teams/2026-bibbidi/issues/217)과 [#219](https://github.com/woowacourse-teams/2026-bibbidi/issues/219)는 안 건드렸다. 아까 #217에 계정 연결을 #219로 넘기는 문구를 이미 넣었고, #219는 `social_identities` 제약만 쓰기 때문에 이번 변경과 겹치는 내용이 없어.

이제 다섯 이슈가 이렇게 물린다.

```
#215  닉네임 유일 제약 제거 + 비밀번호 로그인 회원 조회 분리   (코드 완료, PR 대기)
  └ #216  JWT Access·Refresh          세션과 병행
      └ #217  카카오 OIDC              social_identities 생성
          ├ #218  약관 동의 후 소셜 가입   password_hash NULL 시작점
          └ #219  기존 계정에 카카오 연결   기존 회원 N명용
```

#215는 브랜치 `feature/215`에 커밋 4개로 올라가 있고 테스트·빌드 통과 상태다. PR은 말하면 올릴게.

## 46. 사용자 · 2026-09-21T10:41:05.461Z

근데 이거 왜 정팩메 안 쓰고 new로 한거야?

## 47. Claude · 2026-09-21T10:41:54.119Z

`from(...)`이 받을 게 없어져서 그렇다.

원래는 이랬어.

```java
// 전: 서비스가 Result를 주니까 변환할 게 있었다
NicknameAvailabilityResult result = userService.checkNicknameAvailability(request.nickname());
return NicknameAvailabilityResponse.from(result);
```

네가 `PasswordLoginIdAvailabilityResult`를 지우면서 서비스가 `boolean`만 돌려주게 됐고, 닉네임은 컨트롤러가 `request.nickname()`으로 이미 들고 있다. 그래서 `from`에 넘길 대상 자체가 사라졌다.

```java
// 후
boolean available = userService.isNicknameAvailable(request.nickname());
return new NicknameAvailabilityResponse(request.nickname(), available);
```

## 근데 지적이 맞다

이 컨트롤러 2개에서 응답 DTO 만드는 자리가 6군데인데 **이것만 `new`다.**

```
CurrentUserResponse.from(result)
WeddingDateResponse.from(result)
ChangeNicknameResponse.from(result)
CreateUserResponse.from(result)
LoginResponse.from(result)
new NicknameAvailabilityResponse(...)   ← 혼자
```

AGENTS.md는 "DTO의 정적 팩터리 메서드는 **경계 변환 책임이 분명할 때** 허용한다"라고 돼 있다. 나머지 5개는 서비스 DTO를 HTTP DTO로 바꾸는 변환이 실제로 있어서 `from`이 일을 한다. 여기서 `of(nickname, available)` 같은 걸 만들면 인자 두 개를 생성자에 그대로 넘기기만 해서 하는 일이 없다.

그래서 **나는 `new` 유지 쪽**인데, 팀 리뷰에서 "왜 여기만 다르냐"가 나올 자리인 건 맞아.

선택지는 둘이야.

- **A** 지금대로 둔다. 변환할 게 없으니 껍데기 팩터리를 안 만든다
- **B** 서비스에 Result를 되살리고 `from(result)`로 통일한다. 아까 네가 지운 그 record가 돌아온다

B로 가면 파일이 하나 늘고 아까 정리한 게 되돌아간다. A면 이 한 군데가 눈에 띈다. 어느 쪽으로 갈까?

## 48. 사용자 · 2026-09-21T10:42:20.738Z

바꿔줘 기존의 dto 쓰고

## 49. Claude · 2026-09-21T10:44:06.522Z

기존 DTO 패턴으로 되돌렸다. 테스트·빌드 통과, 푸시 완료.

```java
// UserController - 나머지 5개와 같은 모양
NicknameAvailabilityResult result = userService.checkNicknameAvailability(request.nickname());
return NicknameAvailabilityResponse.from(result);

// UserService
public NicknameAvailabilityResult checkNicknameAvailability(String nickname) {
    boolean isAvailableNickname = !userRepository.existsPasswordLoginUserByNickname(nickname);
    return new NicknameAvailabilityResult(nickname, isAvailableNickname);
}
```

`NicknameAvailabilityResult`와 `NicknameAvailabilityResponse.from()`을 원래 있던 모양 그대로 되살렸다. 이제 이 컨트롤러에서 `new`로 응답을 만드는 자리는 없다.

**결과적으로 base에서 달라진 건 조회 대상 한 줄뿐이야.**

```
existsByNickname(nickname)  →  existsPasswordLoginUserByNickname(nickname)
```

`isNicknameAvailable` boolean 버전은 사라졌고, `UserServiceTest`의 두 테스트도 `NicknameAvailabilityResult`를 검증하는 원래 형태로 돌렸다.

커밋은 네 개 그대로 유지했다.

```
fb646f9  chore: 개발 작업 기록 추가
dd7e0fd  docs: 일반 회원가입과 닉네임 중복 확인을 API 문서에서 뺀다
abd0f8c  refactor: 중복되는 예외 메시지를 상수로 뺀다
3cc4cd4  feat: 닉네임 유일 제약을 제거하고 비밀번호 로그인 회원만 닉네임으로 찾는다
```

DTO 되돌린 건 `feat` 커밋 안에 접어 넣었어. 별도 커밋으로 남기면 "지웠다 되살렸다"가 히스토리에 남는데, 어차피 base에는 없던 왕복이라 안 남기는 게 맞다고 봤다.

#215 본문에는 이 내용이 안 들어가 있는데, 완료 조건 수준의 변화가 아니라 구현 세부라서 뒀어. 넣는 게 낫겠으면 말해줘.

## 50. 사용자 · 2026-09-21T10:44:09.104Z

refactor: 중복되는 예외 메시지를 상수로 뺀다

같은 문자열을 두 군데에서 이어 붙이고 있어 한쪽만 고치면 메시지가 갈라진다. ChecklistRepository가 이미 쓰고 있는 방식에 맞춰 상수로 뺀다.

UserRepository의 회원 없음 메시지는 구분자가 없어 아이디가 문장에 붙어 나오던 것도 userId= 형태로 맞춘다. 이 메시지는 로그에만 쓰이고 응답 본문에는 ClientError의 문구가 나간다.

이 커밋

상수로 빼는게 아니라

서비스에 있는 걸 레포지토리까지 올리라고 트라이 캐치를

팀원랑 내가 한 코드를 좀 확인하고 리팩토링을 좀 해

이거까지 반영하고 커밋 기록 잘 정리해서 다시 보여줘

## 51. Claude · 2026-09-21T10:44:30.086Z

기다려봐. 내가 잘못 읽었네. 팀원 코드부터 다시 보고 갈게.

팀원(`AppointmentRepository`)랑 네 코드(`ChecklistRepository`) 다 봤다. 패턴이 명확하네.

```java
// ChecklistRepository.save - 네가 쓴 방식
public Checklist save(Checklist checklist) {
    validateNotDuplicated(checklist.ownerId());   // ← 검증이 Repository 안에 있다
    ...
}

private void validateNotDuplicated(Long ownerId) {
    if (jpaChecklistRepository.existsByOwnerId(ownerId)) {
        throw new BusinessException(ClientError.DUPLICATE_CHECKLIST, DUPLICATE_CHECKLIST_MESSAGE + ownerId);
    }
}
```

`UserService`가 이걸 혼자 서비스에서 하고 있었다. 맞추겠다.

네 지적대로 다시 했다. 상수 추출은 되돌렸고, `try/catch`가 하던 일을 Repository로 올렸다.

## 바뀐 코드

`ChecklistRepository.save`가 쓰는 모양 그대로 맞췄다.

```java
// UserRepository
private static final String DUPLICATE_NICKNAME_MESSAGE = "이미 사용 중인 닉네임입니다. nickname=";

public User create(User user) {
    validateNicknameNotUsed(user.nickname());
    ...
}

public User update(User user) {
    validateNicknameNotUsedByOthers(user.nickname(), user.id());
    ...
}

private void validateNicknameNotUsed(String nickname) {
    if (jpaUserRepository.existsByNicknameIgnoreCaseAndPasswordHashIsNotNull(nickname)) {
        throw new BusinessException(DUPLICATE_NICKNAME, DUPLICATE_NICKNAME_MESSAGE + nickname);
    }
}
```

`UserService`는 `BusinessException`, `ClientError`, `DataIntegrityViolationException` import가 전부 빠졌다. 이제 중복이라는 개념 자체를 모른다.

```java
@Transactional
public UserResult createUser(String nickname, String passwordHash) {
    User user = new User(null, nickname, passwordHash);
    User savedUser = userRepository.create(user);

    return UserResult.from(savedUser);
}
```

`AuthService` 상수 추출은 통째로 revert했다. 네가 시킨 것도 아닌데 내가 끼워 넣은 거였어. 지금 base와 diff 0이다.

## 커밋 3개

```
8a412a3  chore: 개발 작업 기록 추가
fe7d1d4  docs: 일반 회원가입과 닉네임 중복 확인을 API 문서에서 뺀다
bb6cd1c  feat: 닉네임 유일 제약을 제거하고 비밀번호 로그인 회원만 닉네임으로 찾는다
```

**`refactor:` 커밋을 따로 못 만들었다.** base 기준으로 보면 Service의 `try/catch`는 DB UNIQUE가 있어야 동작하는 코드라, UNIQUE를 떼는 커밋과 옮기는 커밋을 나누면 중간 커밋에서 중복이 그냥 통과해버린다. 초록으로 나눌 수가 없어서 `feat` 하나에 넣고 커밋 메시지 셋째 문단에 그 얘기를 적었다. 나누는 게 낫겠으면 말해줘.

## 테스트도 계층 따라 옮겼다

```
UserServiceTest         중복 거절 테스트 2개 삭제 (mock으로 흉내내던 것)
UserRepositoryIntegrationTest
  + 다른 비밀번호 로그인 회원이 쓰는 닉네임으로는 저장할 수 없다
  + 다른 비밀번호 로그인 회원이 쓰는 닉네임으로는 변경할 수 없다
```

`13개 파일, +107 −354`. 테스트·빌드 통과, `feature/215`에 푸시했다.

남은 건 PR뿐이야. 올릴까?

## 52. 사용자 · 2026-09-21T10:48:12.861Z

그리고 대화 기록 왜 안 말려 들어가니?

## 53. Claude · 2026-09-21T10:48:32.047Z

로거 hook이 죽어서 그렇다. 아까 말한 Node 24 문제 때문에 `UserPromptSubmit`·`Stop` hook이 전부 실패해서, `.devlog/208/`에 남은 게 이것뿐이야.

```
events.jsonl    21줄 (SESSION_STARTED ~ ADR_SKIPPED, 08:58에서 멈춤)
turn-001.diff   0 바이트
```

그 뒤 대화와 turn diff는 아무것도 안 쌓였다. 로거가 못 쓰니 내가 직접 넣을게.
