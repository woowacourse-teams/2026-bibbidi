import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../features/auth";
import { ChecklistMigrationProvider } from "../features/checklist-migration";
import { installLegacyWebSessionFetch } from "../test/webAuth";
import { AuthLayout } from "./AuthLayout";

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: vi.fn().mockReturnValue(null),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthLayout", () => {
  it("로그인 사용자가 인증 화면에 접근하면 홈으로 이동한다", async () => {
    installLegacyWebSessionFetch(
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nickname: "bibbidi" }), {
          status: 200,
        }),
      ),
    );

    render(
      <AuthProvider>
        <ChecklistMigrationProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<h1>로그인 페이지</h1>} />
              </Route>
              <Route path="/" element={<h1>홈 페이지</h1>} />
            </Routes>
          </MemoryRouter>
        </ChecklistMigrationProvider>
      </AuthProvider>,
    );

    expect(screen.getByRole("status").textContent).toBe(
      "로그인 상태를 확인하고 있습니다.",
    );
    expect(
      await screen.findByRole("heading", { name: "홈 페이지" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "로그인 페이지" })).toBeNull();
  });
});
