import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignupPage } from "./SignupPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignupPage", () => {
  it("회원가입이 완료되면 로그인 페이지로 이동한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ id: 1, nickname: "bibbidi" }),
      ok: true,
    });
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
    fireEvent.change(screen.getByLabelText("비밀번호", { exact: true }), {
      target: { value: "wish" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "wish" },
    });
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "로그인 페이지" }),
      ).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
