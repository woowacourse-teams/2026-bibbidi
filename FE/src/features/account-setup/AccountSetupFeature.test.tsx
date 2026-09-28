import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  acceptWebAccessToken,
  clearWebAccessToken,
  currentWebUserId,
  resetWebAuthSessionForTest,
} from "../../infrastructure/auth/webSessionManager";
import { MyChecklistProvider } from "../checklist";
import { AccountSetupFeature } from "./AccountSetupFeature";
import { clearAccountSetupProgress } from "./model/accountSetupProgress";

function accessToken(userId: string): string {
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor((Date.now() + 120_000) / 1_000),
      sub: userId,
    }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function renderFeature(
  overrides: Partial<React.ComponentProps<typeof AccountSetupFeature>> = {},
) {
  const props = {
    isSwitchingAccount: false,
    onAuthenticationExpired: vi.fn(),
    onSuccess: vi.fn(),
    onSwitchAccount: vi.fn(),
    onTermsRequired: vi.fn(),
    switchAccountErrorMessage: null,
    ...overrides,
  };

  const view = render(
    <MyChecklistProvider sessionKey="account-setup-test">
      <AccountSetupFeature {...props} />
    </MyChecklistProvider>,
  );
  return { props, ...view };
}

function selectLegacyAccount() {
  fireEvent.click(screen.getByRole("button", { name: /^기존 계정 이어쓰기/ }));
}

function fillLegacyAccount(password = "bibbidi1234") {
  fireEvent.change(screen.getByLabelText("기존 닉네임"), {
    target: { value: " 기존회원 " },
  });
  fireEvent.change(screen.getByLabelText("기존 비밀번호"), {
    target: { value: password },
  });
}

beforeEach(() => {
  resetWebAuthSessionForTest();
  clearAccountSetupProgress();
  acceptWebAccessToken(accessToken("10"));
});

afterEach(() => {
  resetWebAuthSessionForTest();
  clearAccountSetupProgress();
  vi.unstubAllGlobals();
});

describe("AccountSetupFeature", () => {
  it("기존 계정 입력을 선택하고 이전 선택으로 돌아간다", () => {
    const { unmount } = renderFeature();

    expect(
      screen.getByRole("button", { name: /^기존 계정 이어쓰기/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^새 계정으로 시작하기/ }),
    ).toBeTruthy();

    selectLegacyAccount();
    expect(screen.getByLabelText("기존 닉네임")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "이전 선택으로 돌아가기" }),
    );
    expect(
      screen.getByRole("heading", { name: "사용할 계정을 선택해 주세요" }),
    ).toBeTruthy();

    unmount();
    renderFeature();

    expect(
      screen.getByRole("heading", { name: "사용할 계정을 선택해 주세요" }),
    ).toBeTruthy();
  });

  it("기존 계정 폼은 재마운트 뒤에도 유지하고 입력값은 복원하지 않는다", () => {
    const { unmount } = renderFeature();

    fireEvent.click(
      screen.getByRole("button", { name: /^기존 계정 이어쓰기/ }),
    );
    fireEvent.change(screen.getByLabelText("기존 닉네임"), {
      target: { value: "저장하지 않을 값" },
    });
    unmount();

    renderFeature();

    expect(screen.getByLabelText("기존 닉네임")).toBeTruthy();
    expect(
      (screen.getByLabelText("기존 닉네임") as HTMLInputElement).value,
    ).toBe("");
  });

  it("다른 계정으로 전환 중에는 계정 선택을 막는다", () => {
    renderFeature({ isSwitchingAccount: true });

    expect(
      (
        screen.getByRole("button", {
          name: /^기존 계정 이어쓰기/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: /^새 계정으로 시작하기/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("기존 계정 이전 성공 응답의 새 access token을 반영한다", async () => {
    const onSuccess = vi.fn();
    const transferredToken = accessToken("3");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          accessToken: transferredToken,
          termsAgreementRequired: false,
        },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderFeature({ onSuccess });

    selectLegacyAccount();
    fillLegacyAccount();
    fireEvent.click(screen.getByRole("button", { name: "기존 계정 이어쓰기" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(currentWebUserId()).toBe("3");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users/me/legacy-account-transfer",
      expect.objectContaining({
        body: JSON.stringify({
          nickname: "기존회원",
          password: "bibbidi1234",
        }),
        credentials: "include",
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    { errorCode: 101, status: 400 },
    { errorCode: 202, status: 401 },
  ])(
    "$errorCode 오류면 공개 메시지를 표시하고 비밀번호만 지운다",
    async ({ errorCode, status }) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            jsonResponse({ errorCode, message: "서버 상세 정보" }, status),
          ),
      );
      renderFeature();

      selectLegacyAccount();
      fillLegacyAccount("wrong-password");
      fireEvent.click(
        screen.getByRole("button", { name: "기존 계정 이어쓰기" }),
      );

      expect(
        await screen.findByText("닉네임 또는 비밀번호를 확인해 주세요."),
      ).toBeTruthy();
      expect(
        (screen.getByLabelText("기존 닉네임") as HTMLInputElement).value,
      ).toBe(" 기존회원 ");
      expect(
        (screen.getByLabelText("기존 비밀번호") as HTMLInputElement).value,
      ).toBe("");
      expect(screen.queryByText("서버 상세 정보")).toBeNull();
    },
  );

  it("인증을 유지할 수 없으면 로그인으로 돌아가도록 알린다", async () => {
    const onAuthenticationExpired = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ errorCode: 205, message: "내부 인증 정보" }, 401),
        ),
    );
    renderFeature({ onAuthenticationExpired });

    selectLegacyAccount();
    fillLegacyAccount();
    fireEvent.click(screen.getByRole("button", { name: "기존 계정 이어쓰기" }));

    await waitFor(() => expect(onAuthenticationExpired).toHaveBeenCalledOnce());
    expect(screen.queryByText("내부 인증 정보")).toBeNull();
  });

  it("약관 동의가 필요하다는 응답이면 약관 단계로 돌아간다", async () => {
    const onTermsRequired = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ errorCode: 211, message: "내부 약관 정보" }, 403),
        ),
    );
    renderFeature({ onTermsRequired });

    selectLegacyAccount();
    fillLegacyAccount();
    fireEvent.click(screen.getByRole("button", { name: "기존 계정 이어쓰기" }));

    await waitFor(() => expect(onTermsRequired).toHaveBeenCalledOnce());
    expect(screen.queryByText("내부 약관 정보")).toBeNull();
  });

  it("서버 오류 원문 대신 일반 오류를 표시하고 다시 제출할 수 있다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ errorCode: 901, message: "서버 내부 정보" }, 500),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            accessToken: accessToken("3"),
            termsAgreementRequired: false,
          },
          201,
        ),
      );
    const onSuccess = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderFeature({ onSuccess });

    selectLegacyAccount();
    fillLegacyAccount();
    fireEvent.click(screen.getByRole("button", { name: "기존 계정 이어쓰기" }));

    expect(
      await screen.findByText(
        "계정 설정을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("서버 내부 정보")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "기존 계정 이어쓰기" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it("이전 응답이 유실됐지만 세션의 회원 ID가 바뀌면 완료로 복구한다", async () => {
    const onSuccess = vi.fn();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: accessToken("3"),
          termsAgreementRequired: false,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderFeature({ onSuccess });

    selectLegacyAccount();
    fillLegacyAccount();
    fireEvent.click(screen.getByRole("button", { name: "기존 계정 이어쓰기" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/users/me/legacy-account-transfer",
      "/api/auth/web/sessions/refresh",
    ]);
  });

  it("세션의 회원 ID가 그대로면 자동 재요청하지 않고 수동 재시도를 제공한다", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: accessToken("10"),
          termsAgreementRequired: false,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderFeature();

    selectLegacyAccount();
    fillLegacyAccount();
    fireEvent.click(screen.getByRole("button", { name: "기존 계정 이어쓰기" }));

    expect(
      await screen.findByText(
        "계정 이전이 완료되지 않았어요. 입력 정보를 확인하고 다시 시도해 주세요.",
      ),
    ).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/users/me/legacy-account-transfer",
      ),
    ).toHaveLength(1);
  });

  it("불확실한 이전 뒤 세션도 갱신할 수 없으면 재로그인을 요청한다", async () => {
    const onAuthenticationExpired = vi.fn();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce(
        jsonResponse({ errorCode: 206, message: "세션 만료" }, 401),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderFeature({ onAuthenticationExpired });

    selectLegacyAccount();
    fillLegacyAccount();
    fireEvent.click(screen.getByRole("button", { name: "기존 계정 이어쓰기" }));

    await waitFor(() => expect(onAuthenticationExpired).toHaveBeenCalledOnce());
    expect(screen.queryByText("세션 만료")).toBeNull();
  });

  it("새 계정으로 시작하면 닉네임 변경 없이 빈 체크리스트를 생성한다", async () => {
    const onSuccess = vi.fn();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/checklists/me") {
        return Promise.resolve(
          jsonResponse(
            { errorCode: 303, message: "체크리스트가 없습니다." },
            404,
          ),
        );
      }

      if (url === "/api/checklists") {
        return Promise.resolve(jsonResponse(10, 201));
      }

      return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderFeature({ onSuccess });

    fireEvent.click(
      screen.getByRole("button", { name: /^새 계정으로 시작하기/ }),
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/checklists",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(
      fetchMock.mock.calls.some(([url]) => url === "/api/users/me/nickname"),
    ).toBe(false);
  });

  it("체크리스트 생성 실패를 표시하고 새 계정 생성을 다시 시도한다", async () => {
    const onSuccess = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { errorCode: 303, message: "체크리스트가 없습니다." },
          404,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ errorCode: 901, message: "내부 오류" }, 500),
      )
      .mockResolvedValueOnce(jsonResponse(10, 201));
    vi.stubGlobal("fetch", fetchMock);
    renderFeature({ onSuccess });

    fireEvent.click(
      screen.getByRole("button", { name: /^새 계정으로 시작하기/ }),
    );
    expect(
      await screen.findByText(
        "계정 설정을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.",
      ),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /^새 계정으로 시작하기/ }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it("새 계정 시작 전에 세션이 사라지면 재로그인을 요청한다", async () => {
    const onAuthenticationExpired = vi.fn();
    clearWebAccessToken();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ errorCode: 206, message: "세션 만료" }, 401),
        ),
    );
    renderFeature({ onAuthenticationExpired });

    fireEvent.click(
      screen.getByRole("button", { name: /^새 계정으로 시작하기/ }),
    );

    await waitFor(() => expect(onAuthenticationExpired).toHaveBeenCalledOnce());
    expect(screen.queryByText("세션 만료")).toBeNull();
  });
});
