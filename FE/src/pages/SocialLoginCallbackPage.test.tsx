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
});

describe("SocialLoginCallbackPage", () => {
  it("약관 동의가 필요한 콜백이면 토큰을 반영하고 온보딩으로 replace 이동한다", async () => {
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
        initialEntries={["/login", "/auth/kakao?code=abc&state=xyz"]}
        initialIndex={1}
      >
        <Routes>
          <Route path="/login" element={<h1>로그인 화면</h1>} />
          <Route path="/auth/:provider" element={<SocialLoginCallbackPage />} />
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
    expect(authMocks.refreshAuth).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
    expect(
      await screen.findByRole("heading", { name: "로그인 화면" }),
    ).toBeTruthy();
  });
});
