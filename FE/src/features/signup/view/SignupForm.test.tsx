import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignupForm } from "./SignupForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignupForm", () => {
  it("API 입력 계약과 닉네임 중복 확인을 통과하면 회원가입 버튼을 활성화한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ available: true, nickname: "bibbidi" }),
            { status: 200 },
          ),
        ),
    );
    render(<SignupForm loginLink={<a href="/login">로그인</a>} />);

    const submitButton = screen.getByRole("button", {
      name: "회원가입",
    }) as HTMLButtonElement;

    expect(submitButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "bibbidi" },
    });
    fireEvent.blur(screen.getByLabelText("닉네임"));
    fireEvent.change(screen.getByLabelText("비밀번호", { exact: true }), {
      target: { value: "wish" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "wish" },
    });

    await waitFor(() => {
      expect(submitButton.disabled).toBe(false);
    });
  });

  it("닉네임 입력을 벗어나면 중복을 확인한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ available: false, nickname: "taken" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SignupForm loginLink={<a href="/login">로그인</a>} />);

    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "taken" },
    });
    fireEvent.blur(screen.getByLabelText("닉네임"));

    await waitFor(() => {
      expect(screen.getByText("이미 사용 중인 닉네임입니다.")).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("유효하지 않은 닉네임은 중복을 확인하지 않는다", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SignupForm loginLink={<a href="/login">로그인</a>} />);

    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "12345678901" },
    });
    fireEvent.blur(screen.getByLabelText("닉네임"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("닉네임은 10자 이하로 입력해 주세요."),
    ).toBeTruthy();
  });

  it("중복 확인 API의 닉네임 검증 오류를 표시한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errorCode: 101,
            errors: [
              {
                field: "nickname",
                message: "사용할 수 없는 닉네임입니다.",
              },
            ],
            message: "요청 값이 올바르지 않습니다.",
          }),
          { status: 400 },
        ),
      ),
    );
    render(<SignupForm loginLink={<a href="/login">로그인</a>} />);

    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "bibbidi" },
    });
    fireEvent.blur(screen.getByLabelText("닉네임"));

    expect(
      await screen.findByText("사용할 수 없는 닉네임입니다."),
    ).toBeTruthy();
  });

  it("늦게 도착한 이전 중복 확인 결과를 무시한다", async () => {
    let resolveFirstRequest: (response: Response) => void = () => undefined;
    let resolveSecondRequest: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirstRequest = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecondRequest = resolve;
          }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<SignupForm loginLink={<a href="/login">로그인</a>} />);
    const nicknameInput = screen.getByLabelText("닉네임");

    fireEvent.change(nicknameInput, { target: { value: "first" } });
    fireEvent.blur(nicknameInput);
    fireEvent.change(nicknameInput, { target: { value: "second" } });
    fireEvent.blur(nicknameInput);

    resolveSecondRequest(
      new Response(JSON.stringify({ available: true, nickname: "second" }), {
        status: 200,
      }),
    );
    await screen.findByText("사용 가능한 닉네임입니다.");
    resolveFirstRequest(
      new Response(JSON.stringify({ available: false, nickname: "first" }), {
        status: 200,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText("이미 사용 중인 닉네임입니다.")).toBeNull();
    });
    expect(screen.getByText("사용 가능한 닉네임입니다.")).toBeTruthy();
  });

  it("닉네임 중복 확인 중에는 폼 제출을 처리하지 않는다", () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    render(<SignupForm loginLink={<a href="/login">로그인</a>} />);
    const nicknameInput = screen.getByLabelText("닉네임");

    fireEvent.change(nicknameInput, { target: { value: "bibbidi" } });
    fireEvent.blur(nicknameInput);
    fireEvent.change(screen.getByLabelText("비밀번호", { exact: true }), {
      target: { value: "wish" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "wish" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "회원가입" }).closest("form")!,
    );

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("닉네임 확인 후 입력을 변경하면 확인 결과를 초기화한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ available: true, nickname: "bibbidi" }), {
          status: 200,
        }),
      ),
    );
    render(<SignupForm loginLink={<a href="/login">로그인</a>} />);
    const nicknameInput = screen.getByLabelText("닉네임");

    fireEvent.change(nicknameInput, { target: { value: "bibbidi" } });
    fireEvent.blur(nicknameInput);
    await screen.findByText("사용 가능한 닉네임입니다.");
    fireEvent.change(nicknameInput, { target: { value: "bibbidi2" } });

    expect(screen.queryByText("사용 가능한 닉네임입니다.")).toBeNull();
  });

  it("중복 확인 상태를 닉네임 입력과 연결해 안내한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ available: true, nickname: "bibbidi" }), {
          status: 200,
        }),
      ),
    );
    render(<SignupForm loginLink={<a href="/login">로그인</a>} />);
    const nicknameInput = screen.getByLabelText("닉네임");

    expect(nicknameInput.getAttribute("aria-describedby")).toBe(
      "nickname-message",
    );
    fireEvent.change(nicknameInput, { target: { value: "bibbidi" } });
    fireEvent.blur(nicknameInput);

    const availabilityMessage =
      await screen.findByText("사용 가능한 닉네임입니다.");
    expect(availabilityMessage.id).toBe("nickname-message");
    expect(availabilityMessage.getAttribute("aria-live")).toBe("polite");
  });

  it("비밀번호 보기 기능을 노출하지 않는다", () => {
    render(<SignupForm loginLink={<a href="/login">로그인</a>} />);

    expect(screen.queryByRole("button", { name: "보기" })).toBeNull();
    expect(
      (screen.getByLabelText("비밀번호", { exact: true }) as HTMLInputElement)
        .type,
    ).toBe("password");
    expect(
      (screen.getByLabelText("비밀번호 확인") as HTMLInputElement).type,
    ).toBe("password");
  });

  it("상시 안내를 유효성 검사 오류로 교체한다", () => {
    render(<SignupForm loginLink={<a href="/login">로그인</a>} />);

    expect(
      screen.getByText("닉네임은 10자 이하로 입력해 주세요."),
    ).toBeTruthy();
    expect(
      screen.getByText("비밀번호는 4자 이상 20자 이하로 입력해 주세요."),
    ).toBeTruthy();

    fireEvent.blur(screen.getByLabelText("닉네임"));
    fireEvent.blur(screen.getByLabelText("비밀번호", { exact: true }));

    expect(screen.getByText("닉네임을 입력해 주세요.")).toBeTruthy();
    expect(screen.getByText("비밀번호를 입력해 주세요.")).toBeTruthy();
    expect(
      screen.queryByText("닉네임은 10자 이하로 입력해 주세요."),
    ).toBeNull();
    expect(
      screen.queryByText("비밀번호는 4자 이상 20자 이하로 입력해 주세요."),
    ).toBeNull();
  });
});
