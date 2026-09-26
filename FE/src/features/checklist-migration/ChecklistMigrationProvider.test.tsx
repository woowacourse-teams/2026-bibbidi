import { ReactNode, StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "../auth";
import { installLegacyWebSessionFetch } from "../../test/webAuth";
import { ChecklistMigrationProvider } from "./ChecklistMigrationProvider";

const STORAGE_KEY = "bibbidi:preparation-checklist";

function createChecklistItem(
  id: number,
  sourceCatalogItemId: number | null,
  status: "continue" | "done" | "prev" = "prev",
) {
  return {
    appointments: [],
    categoryId: 10,
    createdAt: "2026-09-23T09:00:00",
    id,
    sourceCatalogItemId,
    status,
    title: `체크리스트 항목 ${id}`,
  };
}

function createStorage(catalogItemIds: number[] = []) {
  let serializedValue =
    catalogItemIds.length === 0
      ? null
      : JSON.stringify({ version: 1, catalogItemIds });

  return {
    getItem: vi.fn(() => serializedValue),
    removeItem: vi.fn(() => {
      serializedValue = null;
    }),
    setItem: vi.fn((_key: string, value: string) => {
      serializedValue = value;
    }),
    getSerializedValue: () => serializedValue,
  };
}

function renderProviders(children: ReactNode, strict = false) {
  const content = (
    <AuthProvider>
      <ChecklistMigrationProvider>{children}</ChecklistMigrationProvider>
    </AuthProvider>
  );

  return render(strict ? <StrictMode>{content}</StrictMode> : content);
}

function AuthStateProbe() {
  const { authState } = useAuth();

  return (
    <p>
      {authState.status}
      {(authState.status === "authenticated" ||
        authState.status === "synchronizing") &&
        `:${authState.user.nickname}`}
    </p>
  );
}

function AuthSessionSwitch() {
  const { authState, beginAuthentication } = useAuth();

  return (
    <>
      <p>
        {authState.status}
        {(authState.status === "authenticated" ||
          authState.status === "synchronizing") &&
          `:${authState.user.nickname}`}
      </p>
      <button
        onClick={() => beginAuthentication({ nickname: "second" })}
        type="button"
      >
        사용자 변경
      </button>
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChecklistMigrationProvider", () => {
  it("Session Cookie 복원 시 누락 항목을 병합한 뒤 인증을 완료한다", async () => {
    const storage = createStorage([101, 102]);
    vi.stubGlobal("localStorage", storage);
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/users/me") {
          return Promise.resolve(
            new Response(JSON.stringify({ nickname: "bibbidi" }), {
              status: 200,
            }),
          );
        }

        if (url === "/api/checklists/me" && init?.method === "GET") {
          const checklistRequestCount = fetchMock.mock.calls.filter(
            ([requestedUrl]) => requestedUrl === "/api/checklists/me",
          ).length;

          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 1,
                items:
                  checklistRequestCount === 1
                    ? [createChecklistItem(10, 101)]
                    : [
                        createChecklistItem(10, 101),
                        createChecklistItem(11, 102),
                      ],
              }),
              { status: 200 },
            ),
          );
        }

        if (url === "/api/checklists/me/catalog-items") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    catalogItemId: 102,
                    categoryId: 10,
                    createdAt: "2026-09-23T09:00:00",
                    id: 11,
                    status: "prev",
                    title: "추가된 할 일",
                  },
                ],
              }),
              { status: 201 },
            ),
          );
        }

        return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
      });
    installLegacyWebSessionFetch(fetchMock);

    renderProviders(<AuthStateProbe />);

    expect(await screen.findByText("authenticated:bibbidi")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/checklists/me/catalog-items",
      expect.objectContaining({ body: JSON.stringify([102]), method: "POST" }),
    );
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(storage.getSerializedValue()).toBeNull();
  });

  it("로컬 ID가 없어도 체크리스트 존재를 확인한 뒤 인증을 완료한다", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/users/me") {
        return Promise.resolve(
          new Response(JSON.stringify({ nickname: "bibbidi" }), {
            status: 200,
          }),
        );
      }

      if (url === "/api/checklists/me") {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 1, items: [] }), { status: 200 }),
        );
      }

      return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
    });
    installLegacyWebSessionFetch(fetchMock);

    renderProviders(<AuthStateProbe />);

    expect(await screen.findByText("authenticated:bibbidi")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users/me",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("체크리스트가 없으면 계정 설정 필요 상태로 전환한다", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/users/me") {
        return Promise.resolve(
          new Response(JSON.stringify({ nickname: "bibbidi" }), {
            status: 200,
          }),
        );
      }

      if (url === "/api/checklists/me") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              errorCode: 303,
              message: "체크리스트가 없습니다.",
            }),
            { status: 404 },
          ),
        );
      }

      return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
    });
    installLegacyWebSessionFetch(fetchMock);

    renderProviders(<AuthStateProbe />);

    expect(await screen.findByText("accountSetupRequired")).toBeTruthy();
  });

  it("준비 항목 이전 실패 후에도 로그인 상태를 유지하고 로컬 ID를 보존한다", async () => {
    const storage = createStorage([101]);
    vi.stubGlobal("localStorage", storage);
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/users/me") {
        return Promise.resolve(
          new Response(JSON.stringify({ nickname: "bibbidi" }), {
            status: 200,
          }),
        );
      }

      if (url === "/api/checklists/me") {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 1, items: [] }), { status: 200 }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ errorCode: 901, message: "서버 오류" }), {
          status: 500,
        }),
      );
    });
    installLegacyWebSessionFetch(fetchMock);

    renderProviders(<AuthStateProbe />);

    expect(await screen.findByText("authenticated:bibbidi")).toBeTruthy();
    expect(storage.getSerializedValue()).toBe(
      JSON.stringify({ version: 1, catalogItemIds: [101] }),
    );
  });

  it("체크리스트 존재 확인 실패는 인증 오류 상태에서 다시 시도하게 한다", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/users/me") {
        return Promise.resolve(
          new Response(JSON.stringify({ nickname: "bibbidi" }), {
            status: 200,
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ errorCode: 901, message: "서버 오류" }), {
          status: 500,
        }),
      );
    });
    installLegacyWebSessionFetch(fetchMock);

    renderProviders(<AuthStateProbe />);

    expect(
      await screen.findByText("로그인 상태를 확인하지 못했습니다."),
    ).toBeTruthy();
  });

  it("동기화 인증 오류는 인증 상태 재확인으로 연결한다", async () => {
    const storage = createStorage([101]);
    vi.stubGlobal("localStorage", storage);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nickname: "bibbidi" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
          { status: 401 },
        ),
      );
    installLegacyWebSessionFetch(fetchMock);

    renderProviders(<AuthStateProbe />);

    expect(await screen.findByText("guest")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(storage.getSerializedValue()).not.toBeNull();
  });

  it("StrictMode에서도 동일 인증 전환의 추가 요청을 한 번만 수행한다", async () => {
    vi.stubGlobal("localStorage", createStorage([101]));
    let hasAddedCatalogItem = false;
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/users/me") {
          return Promise.resolve(
            new Response(JSON.stringify({ nickname: "bibbidi" }), {
              status: 200,
            }),
          );
        }

        if (url === "/api/checklists/me" && init?.method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 1,
                items: hasAddedCatalogItem
                  ? [createChecklistItem(10, 101)]
                  : [],
              }),
              { status: 200 },
            ),
          );
        }

        if (url === "/api/checklists/me/catalog-items") {
          hasAddedCatalogItem = true;
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    catalogItemId: 101,
                    categoryId: 10,
                    createdAt: "2026-09-23T09:00:00",
                    id: 10,
                    status: "prev",
                    title: "추가된 할 일",
                  },
                ],
              }),
              { status: 201 },
            ),
          );
        }

        return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
      });
    installLegacyWebSessionFetch(fetchMock);

    renderProviders(<AuthStateProbe />, true);

    expect(await screen.findByText("authenticated:bibbidi")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/checklists/me/catalog-items",
      ),
    ).toHaveLength(1);
  });

  it("Provider가 제거되면 진행 중인 병합 요청을 취소한다", async () => {
    const storage = createStorage([101]);
    vi.stubGlobal("localStorage", storage);
    let addRequestSignal: AbortSignal | undefined;
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/users/me") {
          return Promise.resolve(
            new Response(JSON.stringify({ nickname: "bibbidi" }), {
              status: 200,
            }),
          );
        }

        if (url === "/api/checklists/me" && init?.method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ id: 1, items: [] }), {
              status: 200,
            }),
          );
        }

        if (url === "/api/checklists/me/catalog-items") {
          addRequestSignal = init?.signal ?? undefined;
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          });
        }

        return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
      });
    installLegacyWebSessionFetch(fetchMock);
    const view = renderProviders(<AuthStateProbe />);

    await waitFor(() => expect(addRequestSignal).toBeDefined());
    view.unmount();

    await waitFor(() => expect(addRequestSignal?.aborted).toBe(true));
    expect(storage.getSerializedValue()).not.toBeNull();
  });

  it("인증 대상이 바뀌면 이전 병합을 취소하고 새 사용자 결과만 반영한다", async () => {
    vi.stubGlobal("localStorage", createStorage([101]));
    let firstAddRequestSignal: AbortSignal | undefined;
    let addRequestCount = 0;
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/users/me") {
          return Promise.resolve(
            new Response(JSON.stringify({ nickname: "first" }), {
              status: 200,
            }),
          );
        }

        if (url === "/api/checklists/me" && init?.method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 1,
                items:
                  addRequestCount >= 2 ? [createChecklistItem(10, 101)] : [],
              }),
              { status: 200 },
            ),
          );
        }

        if (url === "/api/checklists/me/catalog-items") {
          addRequestCount += 1;

          if (addRequestCount === 1) {
            firstAddRequestSignal = init?.signal ?? undefined;
            return new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                reject(new DOMException("aborted", "AbortError"));
              });
            });
          }

          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    catalogItemId: 101,
                    categoryId: 10,
                    createdAt: "2026-09-23T09:00:00",
                    id: 10,
                    status: "prev",
                    title: "추가된 할 일",
                  },
                ],
              }),
              { status: 201 },
            ),
          );
        }

        return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
      });
    installLegacyWebSessionFetch(fetchMock);

    renderProviders(<AuthSessionSwitch />);

    await waitFor(() => expect(firstAddRequestSignal).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "사용자 변경" }));

    expect(await screen.findByText("authenticated:second")).toBeTruthy();
    expect(firstAddRequestSignal?.aborted).toBe(true);
    expect(addRequestCount).toBe(2);
  });
});
