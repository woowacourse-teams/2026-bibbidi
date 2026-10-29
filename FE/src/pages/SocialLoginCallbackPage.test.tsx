import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  acceptWebAccessToken: vi.fn(),
  beginOnboarding: vi.fn(),
  refreshAuth: vi.fn(),
}));

vi.mock("../features/auth", () => ({
  acceptWebAccessToken: authMocks.acceptWebAccessToken,
  useAuth: () => ({
    beginOnboarding: authMocks.beginOnboarding,
    refreshAuth: authMocks.refreshAuth,
  }),
}));

import {
  rememberLoginReturnPath,
  readLoginReturnPath,
} from "../features/auth/model/loginReturnPath";
import { SocialLoginCallbackPage } from "./SocialLoginCallbackPage";

function OnboardingView() {
  const navigate = useNavigate();

  return (
    <>
      <h1>온보딩 화면</h1>
      <button onClick={() => navigate(-1)} type="button">
        뒤로
      </button>
    </>
  );
}

afterEach(() => {
  authMocks.acceptWebAccessToken.mockReset();
  authMocks.beginOnboarding.mockReset();
  authMocks.refreshAuth.mockReset();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("SocialLoginCallbackPage", () => {
  it("기존 회원 OAuth 성공은 보관한 게임 복귀 주소를 로그인 경유로 전달한다", async () => {
    rememberLoginReturnPath("?returnTo=%2Fbalance-game");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accessToken: "active-token",
            termsAgreementRequired: false,
          }),
          { status: 201 },
        ),
      ),
    );
    render(
      <MemoryRouter initialEntries={["/auth/kakao?code=abc&state=xyz"]}>
        <Routes>
          <Route path="/auth/:provider" element={<SocialLoginCallbackPage />} />
          <Route path="/login" element={<h1>로그인 복귀</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "로그인 복귀" }),
    ).toBeTruthy();
    expect(authMocks.refreshAuth).toHaveBeenCalledOnce();
    expect(readLoginReturnPath()).toBeNull();
  });

  it.each(["kakao", "google"])(
    "%s 신규 가입 콜백이면 온보딩으로 replace 이동한다",
    async (provider) => {
      rememberLoginReturnPath("?returnTo=%2Fbalance-game");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              accessToken: "pending-token",
              termsAgreementRequired: true,
            }),
            { status: 201 },
          ),
        ),
      );

      render(
        <MemoryRouter
          initialEntries={["/login", `/auth/${provider}?code=abc&state=xyz`]}
          initialIndex={1}
        >
          <Routes>
            <Route path="/login" element={<h1>로그인 화면</h1>} />
            <Route
              path="/auth/:provider"
              element={<SocialLoginCallbackPage />}
            />
            <Route path="/onboarding" element={<OnboardingView />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(
        await screen.findByRole("heading", { name: "온보딩 화면" }),
      ).toBeTruthy();
      expect(authMocks.acceptWebAccessToken).toHaveBeenCalledWith(
        "pending-token",
      );
      expect(authMocks.beginOnboarding).toHaveBeenCalledOnce();
      expect(readLoginReturnPath()).toBe("/balance-game");
      expect(authMocks.refreshAuth).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
      expect(
        await screen.findByRole("heading", { name: "로그인 화면" }),
      ).toBeTruthy();
    },
  );

  it("가입 완료 소셜 로그인은 인증 상태를 새로 확인한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accessToken: "active-token",
            termsAgreementRequired: false,
          }),
          { status: 201 },
        ),
      ),
    );

    render(
      <MemoryRouter initialEntries={["/auth/kakao?code=abc&state=xyz"]}>
        <Routes>
          <Route path="/auth/:provider" element={<SocialLoginCallbackPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("로그인했어요.")).toBeTruthy();
    expect(authMocks.refreshAuth).toHaveBeenCalledOnce();
  });
});
