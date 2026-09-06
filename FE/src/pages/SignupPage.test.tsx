import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignupPage } from "./SignupPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignupPage", () => {
  it("회원가입이 완료되면 로그인 페이지로 이동한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ available: true, nickname: "bibbidi" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1, nickname: "bibbidi" }), {
          status: 201,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<h1>로그인 페이지</h1>} />
        </Routes>
      </MemoryRouter>,
    );

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
      expect(
        (
          screen.getByRole("button", {
            name: "회원가입",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "로그인 페이지" }),
      ).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("중복 확인 후 닉네임이 선점되면 닉네임 오류를 표시한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ available: true, nickname: "bibbidi" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errorCode: 401,
            message: "이미 사용 중인 닉네임입니다.",
          }),
          { status: 409 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const nicknameInput = screen.getByLabelText("닉네임");
    fireEvent.change(nicknameInput, { target: { value: "bibbidi" } });
    fireEvent.blur(nicknameInput);
    fireEvent.change(screen.getByLabelText("비밀번호", { exact: true }), {
      target: { value: "wish" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "wish" },
    });
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "회원가입" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));

    await screen.findByText("이미 사용 중인 닉네임입니다.");
    expect(
      (screen.getByRole("button", { name: "회원가입" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.queryByText("사용 가능한 닉네임입니다.")).toBeNull();
  });
});
