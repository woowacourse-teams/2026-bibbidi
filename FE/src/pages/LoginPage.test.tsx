import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "../features/auth";
import { LoginPage } from "./LoginPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginPage", () => {
  it("로그인이 완료되면 홈으로 이동한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nickname: "bibbidi" }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    function Home() {
      const { authState } = useAuth();

      return (
        <h1>
          홈 페이지
          {authState.status === "authenticated"
            ? ` ${authState.user.nickname}`
            : ""}
        </h1>
      );
    }

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Home />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    fireEvent.change(await screen.findByLabelText("닉네임"), {
      target: { value: "bibbidi" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "wish" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "홈 페이지 bibbidi" }),
      ).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
