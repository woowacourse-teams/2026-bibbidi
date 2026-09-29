import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SocialLoginCallback } from "./SocialLoginCallback";
import { analytics } from "../../../infrastructure/analytics";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderCallback(
  provider: string,
  search: string,
  onSuccess?: Parameters<typeof SocialLoginCallback>[0]["onSuccess"],
) {
  render(
    <StrictMode>
      <SocialLoginCallback
        loginLink={<a href="/login">로그인으로 돌아가기</a>}
        onSuccess={onSuccess}
        provider={provider}
        search={search}
      />
    </StrictMode>,
  );
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

describe("SocialLoginCallback", () => {
  it.each([
    ["?error=access_denied&error_description=secret", "cancelled"],
    ["?code=secret", "invalid_callback"],
  ])("콜백 입력 %s의 고정 실패 분류만 한 번 보낸다", async (search, kind) => {
    const track = vi.spyOn(analytics, "track");
    renderCallback("kakao", search);
    await screen.findByRole("alert");
    expect(track).toHaveBeenCalledExactlyOnceWith({
      name: "social_login_callback_failed",
      parameters: { provider: "kakao", failure_kind: kind },
    });
  });

  it("208의 state 오류/만료를 구분할 수 있는 범위에서만 계측한다", async () => {
    const track = vi.spyOn(analytics, "track");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ errorCode: 208, message: "secret" }, 401),
        ),
    );
    renderCallback("google", "?code=secret&state=secret");
    await screen.findByRole("alert");
    expect(track).toHaveBeenCalledExactlyOnceWith({
      name: "social_login_callback_failed",
      parameters: {
        provider: "google",
        failure_kind: "state_invalid_or_expired",
      },
    });
  });
  it("돌아온 code와 state를 서버에 한 번만 보낸다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { accessToken: "token", termsAgreementRequired: false },
          201,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderCallback("kakao", "?code=abc&state=xyz");

    expect(await screen.findByText("로그인했어요.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/web/oidc/kakao/callback",
      expect.objectContaining({
        body: JSON.stringify({ code: "abc", state: "xyz" }),
        credentials: "include",
        method: "POST",
      }),
    );
  });

  it("처음 가입한 회원이면 약관 동의가 필요하다고 안내한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { accessToken: "token", termsAgreementRequired: true },
            201,
          ),
        ),
    );

    renderCallback("kakao", "?code=abc&state=xyz");

    expect(
      await screen.findByText(
        "가입을 시작했어요. 약관 동의 화면은 준비 중이에요.",
      ),
    ).toBeTruthy();
  });

  it("콜백 세션을 인증 계층에 전달한다", async () => {
    const onSuccess = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { accessToken: "token", termsAgreementRequired: false },
            201,
          ),
        ),
    );

    renderCallback("kakao", "?code=abc&state=xyz", onSuccess);

    await screen.findByText("로그인했어요.");
    expect(onSuccess).toHaveBeenCalledWith({
      accessToken: "token",
      termsAgreementRequired: false,
    });
  });

  it("서버가 거절하면 서버 메시지를 보여 주고 로그인으로 돌아갈 수 있다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { errorCode: 207, message: "인가 요청이 유효하지 않습니다." },
            400,
          ),
        ),
    );

    renderCallback("kakao", "?code=abc&state=xyz");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "인가 요청이 유효하지 않습니다.",
    );
    expect(
      screen.getByRole("link", { name: "로그인으로 돌아가기" }),
    ).toBeTruthy();
  });

  it("code가 없거나 연동하지 않은 제공자면 서버를 부르지 않는다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderCallback("kakao", "?error=access_denied");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "로그인 결과를 확인하지 못했어요. 다시 시도해 주세요.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
