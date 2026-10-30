import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginModalLayout, LegacyLoginRedirect } from "./LoginModal";
import { useLoginModal } from "../../auth/useLoginModal";
import {
  readLoginReturnPath,
  rememberLoginReturnPath,
} from "../../auth/model/loginReturnPath";

const auth = vi.hoisted(() => ({ status: "guest" }));
vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({
    authState: { status: auth.status },
    endAuthentication: () => {
      auth.status = "guest";
    },
    beginOnboarding: () => {
      auth.status = "onboardingRequired";
    },
    refreshAuth: () => {
      auth.status = "loading";
    },
  }),
}));
vi.mock("../api/socialLogin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/socialLogin")>()),
  startSocialAuthorization: vi
    .fn()
    .mockResolvedValue("https://accounts.example/authorize"),
  completeSocialLogin: vi.fn(),
}));
import { completeSocialLogin } from "../api/socialLogin";
import { SocialLoginCallbackPage } from "../../../pages/SocialLoginCallbackPage";
import { resetWebAuthSessionForTest } from "../../../infrastructure/auth/webSessionManager";

beforeEach(() => {
  auth.status = "guest";
  vi.mocked(completeSocialLogin).mockReset();
});

function Background() {
  const { openLogin, loginTo, loginState } = useLoginModal();
  const { openLogin: openCalendarLogin } = useLoginModal(
    "/calendar?dateFor=101",
  );
  return (
    <main>
      <Link to={loginTo} state={loginState} replace={false}>
        로그인 링크
      </Link>
      <button onClick={openLogin}>로그인 열기</button>
      <button onClick={openCalendarLogin}>선택한 일정으로 로그인</button>
      <input aria-label="작성 중인 내용" />
    </main>
  );
}
function mount(entry = "/preparation?categoryId=20") {
  const router = createMemoryRouter(
    [
      {
        Component: LoginModalLayout,
        children: [
          { path: "/login", Component: LegacyLoginRedirect },
          { path: "/auth/:provider", Component: SocialLoginCallbackPage },
          { path: "/preparation", Component: Background },
          { path: "/calendar", Component: Background },
        ],
      },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  resetWebAuthSessionForTest();
});

describe("LoginModal", () => {
  it("현재 주소의 로그인 링크를 눌러도 닫을 때 배경 화면에 머문다", async () => {
    const router = mount();
    const trigger = screen.getByRole("link", { name: "로그인 링크" });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: "로그인" });
    fireEvent.click(screen.getByRole("button", { name: "로그인 닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.state.location.pathname).toBe("/preparation");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    await act(async () => router.navigate(1));
    expect(await screen.findByRole("dialog", { name: "로그인" })).toBeTruthy();
  });

  it.each(["close", "escape", "backdrop", "back"])(
    "%s로 닫으면 현재 주소와 입력, 실행 버튼 포커스를 보존한다",
    async (method) => {
      const router = mount();
      const draft = screen.getByRole<HTMLInputElement>("textbox");
      fireEvent.change(draft, { target: { value: "준비 중" } });
      const trigger = screen.getByRole("button", { name: "로그인 열기" });
      trigger.focus();
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("dialog", { name: "로그인" });
      expect(router.state.location.pathname).toBe("/preparation");
      expect(router.state.location.search).toBe("?categoryId=20");
      expect(
        screen.getByRole("button", { name: "카카오로 계속하기" }),
      ).toBeTruthy();
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "로그인 닫기" }),
      );
      if (method === "close")
        fireEvent.click(screen.getByRole("button", { name: "로그인 닫기" }));
      if (method === "escape") fireEvent.keyDown(dialog, { key: "Escape" });
      if (method === "backdrop") {
        fireEvent.pointerDown(dialog, { isPrimary: true, button: 0 });
        fireEvent.pointerUp(dialog);
        fireEvent.click(dialog);
      }
      if (method === "back") await act(async () => router.navigate(-1));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(screen.getByRole<HTMLInputElement>("textbox")).toBe(draft);
      expect(draft.value).toBe("준비 중");
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      await act(async () => router.navigate(1));
      expect(
        await screen.findByRole("dialog", { name: "로그인" }),
      ).toBeTruthy();
    },
  );

  it("소셜 인증 전에 선택한 캘린더 항목을 보관한다", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    const router = mount();
    fireEvent.click(
      screen.getByRole("button", { name: "선택한 일정으로 로그인" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "카카오로 계속하기" }),
    );
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://accounts.example/authorize"),
    );
    expect(readLoginReturnPath()).toBe("/calendar?dateFor=101");
    expect(router.state.location.pathname).toBe("/preparation");
  });

  it("이전 로그인 주소도 대상 화면 위에 모달을 열고 닫을 수 있다", async () => {
    const router = mount("/login?returnTo=%2Fcalendar");
    await screen.findByRole("dialog", { name: "로그인" });
    expect(router.state.location.pathname).toBe("/calendar");
    fireEvent.click(screen.getByRole("button", { name: "로그인 닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.state.location.pathname).toBe("/calendar");
    expect(screen.getByRole("main")).toBeTruthy();
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
function termsFetch(
  agreement: () => Response = () => json({ accessToken: "active-token" }),
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url === "/api/terms")
      return json([
        {
          id: 1,
          code: "service",
          version: "2026-09",
          title: "서비스 이용약관",
          content: "약관 전문",
          required: true,
        },
      ]);
    if (url === "/api/users/me/terms-agreement") return agreement();
    if (url === "/api/auth/web/sessions/current")
      return new Response(null, { status: 204 });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("로그인 모달의 실패와 약관 동의", () => {
  it.each(["cancelled", "network"])(
    "%s 콜백 실패를 복귀 화면의 모달에 표시하고 다시 로그인할 수 있다",
    async (kind) => {
      rememberLoginReturnPath("?returnTo=%2Fcalendar");
      vi.mocked(completeSocialLogin).mockRejectedValue(new Error("network"));
      const router = mount(
        kind === "cancelled"
          ? "/auth/kakao?error=access_denied"
          : "/auth/kakao?code=abc&state=xyz",
      );
      await screen.findByRole("alert");
      expect(screen.getByRole("dialog", { name: "로그인" })).toBeTruthy();
      expect(router.state.location.pathname).toBe("/calendar");
      expect(router.state.location.search).toBe("");
      fireEvent.click(
        screen.getByRole("link", { name: "로그인으로 돌아가기" }),
      );
      expect(
        await screen.findByRole("button", { name: "카카오로 계속하기" }),
      ).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "로그인 닫기" }),
      );
      expect(router.state.location.pathname).toBe("/calendar");
    },
  );

  it("신규 회원은 같은 모달에서 약관 전문과 제출 오류를 확인하고 완료 후 선택한 일정으로 복귀한다", async () => {
    rememberLoginReturnPath("?returnTo=%2Fcalendar%3FdateFor%3D101");
    vi.mocked(completeSocialLogin).mockResolvedValue({
      accessToken: "pending-token",
      termsAgreementRequired: true,
    });
    let attempts = 0;
    termsFetch(() =>
      ++attempts === 1
        ? json({ errorCode: 211 }, 400)
        : json({ accessToken: "active-token" }),
    );
    const router = mount("/auth/kakao?code=abc&state=xyz");
    await screen.findByLabelText("전체 동의");
    const dialog = screen.getByRole("dialog", {
      name: "약관 동의",
    });
    expect(router.state.location.pathname).toBe("/calendar");
    expect(router.state.location.search).toBe("?dateFor=101");
    fireEvent.click(
      screen.getByRole("button", { name: "서비스 이용약관 전문 보기" }),
    );
    expect(screen.getByText("약관 전문")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("전체 동의"));
    fireEvent.click(screen.getByRole("button", { name: "동의하고 계속하기" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "약관 동의 상태를 다시 확인해 주세요.",
    );
    expect(screen.getByRole("dialog", { name: "약관 동의" })).toBe(dialog);
    fireEvent.click(screen.getByRole("button", { name: "동의하고 계속하기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(attempts).toBe(2);
    expect(readLoginReturnPath()).toBeNull();
    expect(router.state.location.pathname + router.state.location.search).toBe(
      "/calendar?dateFor=101",
    );
  });

  it("결과를 기다리다 닫으면 늦게 도착한 응답으로 로그인하거나 약관 모달을 다시 열지 않는다", async () => {
    rememberLoginReturnPath("?returnTo=%2Fcalendar");
    let resolve!: (session: {
      accessToken: string;
      termsAgreementRequired: boolean;
    }) => void;
    vi.mocked(completeSocialLogin).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const router = mount("/auth/kakao?code=abc&state=xyz");
    await screen.findByText("로그인하고 있어요.");
    fireEvent.click(screen.getByRole("button", { name: "로그인 닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await act(async () =>
      resolve({ accessToken: "pending-token", termsAgreementRequired: true }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(auth.status).toBe("guest");
    expect(router.state.location.pathname).toBe("/calendar");
  });

  it("약관 모달을 닫으면 동의하지 않고 임시 세션을 정리한다", async () => {
    rememberLoginReturnPath("?returnTo=%2Fcalendar");
    vi.mocked(completeSocialLogin).mockResolvedValue({
      accessToken: "pending-token",
      termsAgreementRequired: true,
    });
    const fetchMock = termsFetch();
    const router = mount("/auth/kakao?code=abc&state=xyz");
    await screen.findByLabelText("전체 동의");
    fireEvent.click(screen.getByRole("button", { name: "약관 동의 닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.state.location.pathname).toBe("/calendar");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/web/sessions/current",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(
      fetchMock.mock.calls.some(
        ([url]) => url.toString() === "/api/users/me/terms-agreement",
      ),
    ).toBe(false);
  });
});
