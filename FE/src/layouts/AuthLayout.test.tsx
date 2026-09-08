import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../features/auth";
import { AuthLayout } from "./AuthLayout";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthLayout", () => {
  it("로그인 사용자가 인증 화면에 접근하면 홈으로 이동한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nickname: "bibbidi" }), {
          status: 200,
        }),
      ),
    );

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<h1>로그인 페이지</h1>} />
            </Route>
            <Route path="/" element={<h1>홈 페이지</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "홈 페이지" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "로그인 페이지" })).toBeNull();
  });
});
