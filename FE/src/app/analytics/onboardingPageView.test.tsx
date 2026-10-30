import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { createMemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { AuthState } from "../../features/auth/model/auth";
import { AppPageViewTracker } from "./AppPageViewTracker";

const auth = vi.hoisted(() => ({ state: { status: "loading" } as AuthState }));
vi.mock("../../features/auth", () => ({
  useAuth: () => ({ authState: auth.state }),
}));

describe("온보딩 페이지 계측", () => {
  it("StrictMode에서도 약관을 한 번 측정하고 인증 동기화 중에는 회원 ID를 전달하지 않는다", async () => {
    const analytics = {
      initialize: vi.fn(),
      setContext: vi.fn(),
      reset: vi.fn(),
      track: vi.fn(),
    };
    const router = createMemoryRouter([{ path: "*", element: null }], {
      initialEntries: ["/onboarding?private=secret"],
    });
    auth.state = { status: "onboardingRequired" };
    const element = () => (
      <StrictMode>
        <AppPageViewTracker
          analytics={analytics}
          origin="https://example.com"
          router={router}
        />
      </StrictMode>
    );
    const view = render(element());
    expect(analytics.track).toHaveBeenCalledOnce();
    expect(analytics.track).toHaveBeenLastCalledWith(
      expect.objectContaining({
        parameters: expect.objectContaining({ page_path: "/onboarding" }),
      }),
    );
    auth.state = {
      status: "synchronizing",
      user: { id: 999, nickname: "private" },
    };
    await act(async () => {
      await router.navigate("/onboarding");
    });
    view.rerender(element());
    expect(analytics.track).toHaveBeenCalledOnce();
    expect(analytics.setContext).toHaveBeenLastCalledWith({
      authState: "synchronizing",
      pathname: "/onboarding",
      userId: undefined,
    });
    auth.state = {
      status: "authenticated",
      user: { id: 42, nickname: "private" },
    };
    view.rerender(element());
    expect(analytics.setContext).toHaveBeenLastCalledWith({
      authState: "authenticated",
      pathname: "/onboarding",
      userId: 42,
    });
    expect(JSON.stringify(analytics.track.mock.calls)).not.toContain("secret");
  });

  it("OAuth 콜백은 온보딩 상태여도 페이지뷰로 보내지 않는다", () => {
    const analytics = {
      initialize: vi.fn(),
      setContext: vi.fn(),
      reset: vi.fn(),
      track: vi.fn(),
    };
    auth.state = { status: "onboardingRequired" };
    const router = createMemoryRouter([{ path: "*", element: null }], {
      initialEntries: ["/auth/kakao?code=secret&state=secret"],
    });
    render(
      <AppPageViewTracker
        analytics={analytics}
        origin="https://example.com"
        router={router}
      />,
    );
    expect(analytics.track).not.toHaveBeenCalled();
  });
});
