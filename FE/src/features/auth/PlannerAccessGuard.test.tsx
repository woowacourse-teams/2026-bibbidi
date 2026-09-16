import { fireEvent, render, screen } from "@testing-library/react";
import { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChecklistMigrationProvider } from "../checklist-migration";
import { AuthProvider, useAuth } from "./AuthProvider";
import { PlannerAccessGuard } from "./PlannerAccessGuard";

function LocationView() {
  const location = useLocation();

  return <p>{`${location.pathname}${location.search}`}</p>;
}

function ExpiringPlanner() {
  const { refreshAuth } = useAuth();

  return (
    <button onClick={refreshAuth} type="button">
      세션 다시 확인
    </button>
  );
}

function renderPlanner(content: ReactNode = <h1>플래너 대시보드</h1>) {
  return render(
    <AuthProvider>
      <ChecklistMigrationProvider>
        <MemoryRouter initialEntries={["/planner"]}>
          <Routes>
            <Route element={<PlannerAccessGuard />}>
              <Route path="/planner" element={content} />
            </Route>
            <Route path="/login" element={<LocationView />} />
          </Routes>
        </MemoryRouter>
      </ChecklistMigrationProvider>
    </AuthProvider>,
  );
}

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

describe("PlannerAccessGuard", () => {
  it("인증 확인 중에는 플래너 접근자를 리다이렉트하지 않고 로딩 상태를 표시한다", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );

    renderPlanner();

    expect(screen.getByRole("status").textContent).toBe(
      "로그인 상태를 확인하고 있습니다.",
    );
    expect(
      screen.queryByRole("heading", { name: "플래너 대시보드" }),
    ).toBeNull();
  });

  it("인증 사용자는 플래너를 표시한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nickname: "bibbidi" }), {
          status: 200,
        }),
      ),
    );

    renderPlanner();

    expect(
      await screen.findByRole("heading", { name: "플래너 대시보드" }),
    ).toBeTruthy();
  });

  it("비로그인 사용자는 안전한 플래너 복귀 정보를 유지해 로그인으로 보낸다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
            { status: 401 },
          ),
        ),
    );

    renderPlanner();

    expect(await screen.findByText("/login?returnTo=%2Fplanner")).toBeTruthy();
  });

  it("플래너 이용 중 세션이 사라지면 같은 로그인 접근 제어를 적용한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ nickname: "bibbidi" }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
            { status: 401 },
          ),
        ),
    );

    renderPlanner(<ExpiringPlanner />);
    fireEvent.click(
      await screen.findByRole("button", { name: "세션 다시 확인" }),
    );

    expect(await screen.findByText("/login?returnTo=%2Fplanner")).toBeTruthy();
  });
});
