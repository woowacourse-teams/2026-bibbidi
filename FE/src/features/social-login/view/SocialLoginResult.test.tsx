import { fireEvent, render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
  useLocation,
  useParams,
} from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  acceptWebAccessToken: vi.fn(),
  beginOnboarding: vi.fn(),
  refreshAuth: vi.fn(),
}));

vi.mock("../../auth", () => ({
  acceptWebAccessToken: authMocks.acceptWebAccessToken,
  useAuth: () => ({
    beginOnboarding: authMocks.beginOnboarding,
    refreshAuth: authMocks.refreshAuth,
  }),
}));

import {
  rememberLoginReturnPath,
  readLoginReturnPath,
} from "../../auth/model/loginReturnPath";
import { SocialLoginResult } from "./SocialLoginResult";
function SocialLoginCallbackPage() {
  const { provider = "" } = useParams();
  const { search } = useLocation();
  return (
    <SocialLoginResult
      provider={provider}
      search={search}
      returnTo={readLoginReturnPath() ?? "/"}
    />
  );
}

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

describe("SocialLoginResult", () => {
  it("기존 회원 OAuth 성공은 보관한 게임 복귀 주소로 이동한다", async () => {
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
          <Route path="/balance-game" element={<h1>게임 복귀</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "게임 복귀" }),
    ).toBeTruthy();
    expect(authMocks.refreshAuth).toHaveBeenCalledOnce();
    expect(readLoginReturnPath()).toBeNull();
  });

  it.each(["kakao", "google"])(
    "%s 신규 가입 콜백이면 기존 화면에서 약관 모달로 전환한다",
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
            <Route path="/balance-game" element={<OnboardingView />} />
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
          <Route path="/" element={<h1>홈 화면</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "홈 화면" }),
    ).toBeTruthy();
    expect(authMocks.refreshAuth).toHaveBeenCalledOnce();
  });
});
