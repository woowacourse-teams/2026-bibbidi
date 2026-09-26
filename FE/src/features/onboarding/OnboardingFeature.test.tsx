import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  acceptWebAccessToken,
  resetWebAuthSessionForTest,
} from "../../infrastructure/auth/webSessionManager";
import { OnboardingFeature } from "./OnboardingFeature";

const requiredTerms = [
  {
    id: 1,
    code: "service",
    version: "2026-09",
    title: "서비스 이용약관",
    content: "서비스 이용약관 전문",
    required: true,
  },
  {
    id: 2,
    code: "privacy",
    version: "2026-09",
    title: "개인정보 처리방침",
    content: "개인정보 처리방침 전문",
    required: true,
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

async function agreeToAllTerms() {
  await screen.findByRole("heading", { name: "가입 마무리" });
  fireEvent.click(screen.getByLabelText("전체 동의"));
}

beforeEach(() => {
  resetWebAuthSessionForTest();
  acceptWebAccessToken("pending-token");
});

afterEach(() => {
  resetWebAuthSessionForTest();
  vi.unstubAllGlobals();
});

describe("OnboardingFeature", () => {
  it("약관 전문과 전체 동의를 제공하고 동의 후 새 토큰을 반영한다", async () => {
    const onSuccess = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(requiredTerms))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "active-token" }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OnboardingFeature
        isSwitchingAccount={false}
        onAuthenticationExpired={vi.fn()}
        onSuccess={onSuccess}
        onSwitchAccount={vi.fn()}
        switchAccountErrorMessage={null}
      />,
    );

    expect(await screen.findByText("서비스 이용약관")).toBeTruthy();
    const serviceTermsItem = screen.getByText("서비스 이용약관").closest("li");
    if (!serviceTermsItem) {
      throw new Error("서비스 이용약관 항목을 찾지 못했습니다.");
    }
    fireEvent.click(
      within(serviceTermsItem).getByRole("button", {
        name: "서비스 이용약관 전문 보기",
      }),
    );
    expect(screen.getByText("서비스 이용약관 전문")).toBeTruthy();
    expect(
      within(serviceTermsItem).getByRole("button", {
        name: "서비스 이용약관 전문 접기",
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByLabelText("서비스 이용약관"));
    fireEvent.click(screen.getByLabelText("개인정보 처리방침"));
    expect(
      (screen.getByLabelText("전체 동의") as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("서비스 이용약관") as HTMLInputElement).checked,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "동의하고 계속하기" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/users/me/terms-agreement");
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ termsVersion: "2026-09", agreed: true }),
        method: "POST",
      }),
    );
    expect(
      new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get(
        "Authorization",
      ),
    ).toBe("Bearer pending-token");
  });

  it("약관 동의 응답이 유실되면 세션을 갱신하고 다음 단계로 이동한다", async () => {
    const onSuccess = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(requiredTerms))
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: "recovered-active-token",
          termsAgreementRequired: false,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OnboardingFeature
        isSwitchingAccount={false}
        onAuthenticationExpired={vi.fn()}
        onSuccess={onSuccess}
        onSwitchAccount={vi.fn()}
        switchAccountErrorMessage={null}
      />,
    );

    await agreeToAllTerms();
    fireEvent.click(screen.getByRole("button", { name: "동의하고 계속하기" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/terms",
      "/api/users/me/terms-agreement",
      "/api/auth/web/sessions/refresh",
    ]);
  });

  it("약관 동의가 명시적으로 실패하면 사용자가 다시 제출할 수 있다", async () => {
    const onSuccess = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(requiredTerms))
      .mockResolvedValueOnce(
        jsonResponse({ errorCode: 901, message: "서버 내부 정보" }, 500),
      )
      .mockResolvedValueOnce(jsonResponse({ accessToken: "active-token" }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OnboardingFeature
        isSwitchingAccount={false}
        onAuthenticationExpired={vi.fn()}
        onSuccess={onSuccess}
        onSwitchAccount={vi.fn()}
        switchAccountErrorMessage={null}
      />,
    );

    await agreeToAllTerms();
    fireEvent.click(screen.getByRole("button", { name: "동의하고 계속하기" }));
    expect(
      await screen.findByText(
        "약관 동의를 처리하지 못했어요. 다시 시도해 주세요.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("서버 내부 정보")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "동의하고 계속하기" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/users/me/terms-agreement",
      ),
    ).toHaveLength(2);
  });

  it("필수 약관 버전이 여러 개면 제출을 막고 재시도를 제공한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse([
            requiredTerms[0],
            { ...requiredTerms[1], version: "2026-10" },
          ]),
        ),
    );

    render(
      <OnboardingFeature
        isSwitchingAccount={false}
        onAuthenticationExpired={vi.fn()}
        onSuccess={vi.fn()}
        onSwitchAccount={vi.fn()}
        switchAccountErrorMessage={null}
      />,
    );

    expect(
      await screen.findByText(
        "약관 정보를 확인하지 못했어요. 다시 불러와 주세요.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "동의하고 계속하기" }),
    ).toBeNull();
  });

  it("인증을 갱신할 수 없으면 로그인 만료를 알린다", async () => {
    const onAuthenticationExpired = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(requiredTerms))
      .mockResolvedValueOnce(
        jsonResponse({ errorCode: 201, message: "내부 인증 정보" }, 401),
      )
      .mockResolvedValueOnce(
        jsonResponse({ errorCode: 206, message: "내부 세션 정보" }, 401),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OnboardingFeature
        isSwitchingAccount={false}
        onAuthenticationExpired={onAuthenticationExpired}
        onSuccess={vi.fn()}
        onSwitchAccount={vi.fn()}
        switchAccountErrorMessage={null}
      />,
    );

    await agreeToAllTerms();
    fireEvent.click(screen.getByRole("button", { name: "동의하고 계속하기" }));

    await waitFor(() => expect(onAuthenticationExpired).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/terms",
      "/api/users/me/terms-agreement",
      "/api/auth/web/sessions/refresh",
    ]);
    expect(screen.queryByText("내부 인증 정보")).toBeNull();
    expect(screen.queryByText("내부 세션 정보")).toBeNull();
  });

  it("약관 로딩 중에도 다른 계정으로 전환할 수 있고 실패 메시지를 표시한다", () => {
    const onSwitchAccount = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(
      <OnboardingFeature
        isSwitchingAccount={false}
        onAuthenticationExpired={vi.fn()}
        onSuccess={vi.fn()}
        onSwitchAccount={onSwitchAccount}
        switchAccountErrorMessage="로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요."
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "다른 계정으로 로그인" }),
    );

    expect(onSwitchAccount).toHaveBeenCalledOnce();
    expect(
      screen.getByText("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요."),
    ).toBeTruthy();
  });

  it("화면에서 이탈하면 진행 중인 약관 조회를 취소한다", () => {
    const capturedRequest: { signal?: AbortSignal } = {};
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
          capturedRequest.signal = init?.signal ?? undefined;

          return new Promise<Response>((_resolve, reject) => {
            capturedRequest.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("aborted", "AbortError")),
              { once: true },
            );
          });
        }),
    );

    const view = render(
      <OnboardingFeature
        isSwitchingAccount={false}
        onAuthenticationExpired={vi.fn()}
        onSuccess={vi.fn()}
        onSwitchAccount={vi.fn()}
        switchAccountErrorMessage={null}
      />,
    );

    expect(capturedRequest.signal).toBeDefined();
    view.unmount();
    expect(capturedRequest.signal?.aborted).toBe(true);
  });
});
