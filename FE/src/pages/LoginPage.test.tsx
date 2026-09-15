import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "../features/auth";
import { ChecklistMigrationProvider } from "../features/checklist-migration";
import { LoginPage } from "./LoginPage";

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
          <ChecklistMigrationProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Home />} />
            </Routes>
          </ChecklistMigrationProvider>
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

  it("로그인 성공 후 로컬 준비 항목을 병합하고 홈으로 이동한다", async () => {
    const storage = {
      getItem: vi
        .fn()
        .mockReturnValue(JSON.stringify({ version: 1, catalogItemIds: [101] })),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    vi.stubGlobal("localStorage", storage);
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
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1, items: [] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [{ id: 10, catalogItemId: 101 }] }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 1,
            items: [{ id: 10, isDone: false, sourceCatalogItemId: 101 }],
          }),
          { status: 200 },
        ),
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
          <ChecklistMigrationProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Home />} />
            </Routes>
          </ChecklistMigrationProvider>
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

    expect(
      await screen.findByRole("heading", { name: "홈 페이지 bibbidi" }),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/checklists/me/catalog-items",
      expect.objectContaining({ body: JSON.stringify([101]), method: "POST" }),
    );
    expect(storage.removeItem).toHaveBeenCalledWith(
      "bibbidi:preparation-checklist",
    );
  });
});
