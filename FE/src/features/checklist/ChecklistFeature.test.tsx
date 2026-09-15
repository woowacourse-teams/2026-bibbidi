import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../shared/responsive";
import { installMatchMedia } from "../../test/matchMedia";

const authMocks = vi.hoisted(() => ({
  authState: { status: "guest" } as
    | { status: "authenticated"; user: { nickname: string } }
    | { status: "error" }
    | { status: "guest" }
    | { status: "loading" }
    | { status: "synchronizing"; user: { nickname: string } },
  refreshAuth: vi.fn(),
}));
const repositoryMocks = vi.hoisted(() => {
  const getChecklist = vi.fn();

  return {
    checklistRevision: 0,
    current: { getChecklist },
    getChecklist,
  };
});

vi.mock("../auth", () => ({
  useAuth: () => ({
    authState: authMocks.authState,
    refreshAuth: authMocks.refreshAuth,
  }),
}));
vi.mock("./checklistQueryDependencies", () => ({
  useChecklistQueryRepository: () => repositoryMocks.current,
  useChecklistRevision: () => repositoryMocks.checklistRevision,
}));

import { ChecklistFeature } from "./ChecklistFeature";
import { ChecklistQueryModel } from "./model/checklistQuery";
import {
  ChecklistQueryAuthenticationRequiredError,
  ChecklistQueryLoadError,
  ChecklistQueryRequestAbortedError,
} from "./repository/checklistQueryRepository";

function createChecklist(title = "로컬 체크리스트 항목"): ChecklistQueryModel {
  return {
    categories: [
      { id: "20", items: [], title: "두 번째 카테고리" },
      {
        id: "10",
        items: [
          {
            appointments: [],
            categoryId: "10",
            checklistItemId: null,
            id: "catalog-item-101",
            isDone: false,
            sourceCatalogItemId: 101,
            title,
          },
        ],
        title: "첫 번째 카테고리",
      },
    ],
  };
}

function RouterControls() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <div data-testid="current-url">
        {`${location.pathname}${location.search}`}
      </div>
      <button onClick={() => navigate(-1)} type="button">
        브라우저 뒤로가기
      </button>
    </>
  );
}

function ChecklistFeatureTestApp({
  initialEntries = ["/checklist"],
}: {
  initialEntries?: string[];
}) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <ChecklistFeature />
      <RouterControls />
    </MemoryRouter>
  );
}

function renderChecklistFeature(initialEntries?: string[]) {
  return render(<ChecklistFeatureTestApp initialEntries={initialEntries} />);
}

function getCurrentUrl() {
  return screen.getByTestId("current-url").textContent;
}

beforeEach(() => {
  authMocks.authState = { status: "guest" };
  authMocks.refreshAuth.mockReset();
  repositoryMocks.checklistRevision = 0;
  repositoryMocks.getChecklist.mockReset();
  repositoryMocks.getChecklist.mockResolvedValue(createChecklist());
  repositoryMocks.current = { getChecklist: repositoryMocks.getChecklist };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChecklistFeature 인증 상태별 조회", () => {
  it("인증 확인 중에는 접근 가능한 로딩 상태를 표시하고 조회하지 않는다", () => {
    authMocks.authState = { status: "loading" };

    renderChecklistFeature();

    expect(screen.getByRole("status").textContent).toBe(
      "체크리스트를 불러오고 있어요.",
    );
    expect(repositoryMocks.getChecklist).not.toHaveBeenCalled();
  });

  it("synchronizing 중에는 이전 guest 결과를 숨기고 새로 조회하지 않는다", async () => {
    const view = renderChecklistFeature();
    expect(await screen.findByText("로컬 체크리스트 항목")).toBeTruthy();

    authMocks.authState = {
      status: "synchronizing",
      user: { nickname: "bibbidi" },
    };
    view.rerender(<ChecklistFeatureTestApp />);

    expect(screen.queryByText("로컬 체크리스트 항목")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "체크리스트를 불러오고 있어요.",
    );
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("비로그인 audience의 Local Storage 조합 결과를 표시한다", async () => {
    renderChecklistFeature();

    expect(await screen.findByText("로컬 체크리스트 항목")).toBeTruthy();
    expect(repositoryMocks.getChecklist).toHaveBeenCalledWith(
      "guest",
      expect.any(AbortSignal),
    );
  });

  it("로그인 audience의 서버 항목과 직접 작성 항목을 서버 순서로 표시한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue({
      categories: [
        {
          id: "10",
          items: [
            {
              appointments: [],
              categoryId: "10",
              checklistItemId: 10,
              id: "checklist-item-10",
              isDone: false,
              sourceCatalogItemId: 101,
              title: "서버 Catalog 항목",
            },
            {
              appointments: [],
              categoryId: "10",
              checklistItemId: 11,
              id: "checklist-item-11",
              isDone: false,
              sourceCatalogItemId: null,
              title: "직접 작성 항목",
            },
          ],
          title: "첫 번째 카테고리",
        },
      ],
    });

    renderChecklistFeature();

    await screen.findByText("직접 작성 항목");
    expect(
      screen
        .getAllByRole("listitem")
        .map((item) => within(item).getByText(/항목$/).textContent),
    ).toEqual(["서버 Catalog 항목", "직접 작성 항목"]);
    expect(repositoryMocks.getChecklist).toHaveBeenCalledWith(
      "authenticated",
      expect.any(AbortSignal),
    );
  });

  it("단순 리렌더링으로 조회를 반복하지 않는다", async () => {
    const view = renderChecklistFeature();
    await screen.findByText("로컬 체크리스트 항목");

    view.rerender(<ChecklistFeatureTestApp />);

    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("할 일 상세 패널을 열어도 체크리스트를 다시 조회하지 않는다", async () => {
    renderChecklistFeature();

    fireEvent.click(
      await screen.findByRole("button", { name: /로컬 체크리스트 항목/ }),
    );

    expect(
      screen.getByRole("complementary", { name: "로컬 체크리스트 항목" }),
    ).toBeTruthy();
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });
});

describe("ChecklistFeature 상세 URL 선택", () => {
  it("할 일 클릭과 닫기·Escape를 URL에 반영하고 다른 query와 포커스를 유지한다", async () => {
    const checklist = createChecklist("URL 인코딩 할 일");
    checklist.categories[1]!.items[0]!.id = "task-한글";
    repositoryMocks.getChecklist.mockResolvedValue(checklist);
    renderChecklistFeature(["/checklist?filter=remaining"]);

    const taskButton = await screen.findByRole("button", {
      name: /URL 인코딩 할 일/,
    });
    fireEvent.click(taskButton);

    expect(getCurrentUrl()).toBe(
      "/checklist?filter=remaining&taskId=task-%ED%95%9C%EA%B8%80",
    );
    expect(
      screen.getByRole("complementary", { name: "URL 인코딩 할 일" }),
    ).toBeTruthy();
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "할 일 상세 닫기" }));

    expect(getCurrentUrl()).toBe("/checklist?filter=remaining");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(document.activeElement).toBe(taskButton);

    fireEvent.click(taskButton);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(getCurrentUrl()).toBe("/checklist?filter=remaining");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(document.activeElement).toBe(taskButton);
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("브라우저 뒤로가기로 이전 선택과 목록 상태를 복원한다", async () => {
    const checklist = createChecklist("첫 번째 할 일");
    checklist.categories[1]!.items.push({
      ...checklist.categories[1]!.items[0]!,
      id: "catalog-item-102",
      sourceCatalogItemId: 102,
      title: "두 번째 할 일",
    });
    repositoryMocks.getChecklist.mockResolvedValue(checklist);
    renderChecklistFeature();

    const firstTaskButton = await screen.findByRole("button", {
      name: /첫 번째 할 일/,
    });
    fireEvent.click(firstTaskButton);
    fireEvent.click(screen.getByRole("button", { name: /두 번째 할 일/ }));
    expect(getCurrentUrl()).toBe("/checklist?taskId=catalog-item-102");

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));

    expect(getCurrentUrl()).toBe("/checklist?taskId=catalog-item-101");
    expect(
      screen.getByRole("complementary", { name: "첫 번째 할 일" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));

    expect(getCurrentUrl()).toBe("/checklist");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(document.activeElement).toBe(firstTaskButton);
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("모바일에서 URL로 상세를 열고 브라우저 뒤로가기로 목록에 복귀한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    renderChecklistFeature();

    fireEvent.click(
      await screen.findByRole("button", { name: /로컬 체크리스트 항목/ }),
    );

    expect(getCurrentUrl()).toBe("/checklist?taskId=catalog-item-101");
    expect(
      screen.getByRole("region", { name: "로컬 체크리스트 항목" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));

    expect(getCurrentUrl()).toBe("/checklist");
    expect(
      screen.queryByRole("region", { name: "로컬 체크리스트 항목" }),
    ).toBeNull();
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("모바일 목록에서 연 상세의 상단 뒤로가기는 중복 목록 entry를 남기지 않는다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    renderChecklistFeature(["/outside", "/checklist"]);

    fireEvent.click(
      await screen.findByRole("button", { name: /로컬 체크리스트 항목/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "체크리스트로 돌아가기" }),
    );

    expect(getCurrentUrl()).toBe("/checklist");

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));
    expect(getCurrentUrl()).toBe("/outside");
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("모바일 상세 직접 접근의 상단 뒤로가기는 현재 entry를 목록으로 교체한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    renderChecklistFeature([
      "/outside",
      "/checklist?filter=remaining&taskId=catalog-item-101",
    ]);

    const detailPage = await screen.findByRole("region", {
      name: "로컬 체크리스트 항목",
    });
    fireEvent.click(
      within(detailPage).getByRole("button", {
        name: "체크리스트로 돌아가기",
      }),
    );

    expect(getCurrentUrl()).toBe("/checklist?filter=remaining");
    expect(
      screen.queryByRole("region", { name: "로컬 체크리스트 항목" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));
    expect(getCurrentUrl()).toBe("/outside");
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("모바일 상세 직접 접근은 로딩과 오류 중에도 상세 셸과 안전한 뒤로가기를 유지한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    let rejectChecklist: (reason?: unknown) => void = () => undefined;
    repositoryMocks.getChecklist.mockImplementation(
      () =>
        new Promise<ChecklistQueryModel>((_resolve, reject) => {
          rejectChecklist = reject;
        }),
    );
    renderChecklistFeature([
      "/outside",
      "/checklist?filter=remaining&taskId=catalog-item-101",
    ]);

    const loadingDetailPage = screen.getByRole("region", {
      name: "할 일 상세",
    });
    expect(within(loadingDetailPage).getByRole("status")).toBeTruthy();

    await act(async () => {
      rejectChecklist(new ChecklistQueryLoadError());
    });

    const errorDetailPage = await screen.findByRole("region", {
      name: "할 일 상세",
    });
    expect(within(errorDetailPage).getByRole("alert")).toBeTruthy();
    fireEvent.click(
      within(errorDetailPage).getByRole("button", {
        name: "체크리스트로 돌아가기",
      }),
    );

    expect(getCurrentUrl()).toBe("/checklist?filter=remaining");
    expect(screen.queryByRole("region", { name: "할 일 상세" })).toBeNull();
  });

  it("breakpoint 전환은 URL과 history를 변경하지 않고 같은 항목을 유지한다", async () => {
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    renderChecklistFeature([
      "/checklist?source=before",
      "/checklist?taskId=catalog-item-101",
    ]);

    expect(
      await screen.findByRole("complementary", {
        name: "로컬 체크리스트 항목",
      }),
    ).toBeTruthy();

    act(() => media.setMatches(true));
    expect(getCurrentUrl()).toBe("/checklist?taskId=catalog-item-101");
    expect(
      screen.getByRole("region", { name: "로컬 체크리스트 항목" }),
    ).toBeTruthy();

    act(() => media.setMatches(false));
    expect(getCurrentUrl()).toBe("/checklist?taskId=catalog-item-101");
    expect(
      screen.getByRole("complementary", {
        name: "로컬 체크리스트 항목",
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));
    expect(getCurrentUrl()).toBe("/checklist?source=before");
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("상세 URL을 로딩 중 유지하고 데이터가 준비되면 패널을 연다", async () => {
    let resolveChecklist: (checklist: ChecklistQueryModel) => void = () =>
      undefined;
    repositoryMocks.getChecklist.mockImplementation(
      () =>
        new Promise<ChecklistQueryModel>((resolve) => {
          resolveChecklist = resolve;
        }),
    );
    renderChecklistFeature([
      "/checklist?filter=remaining&taskId=catalog-item-101",
    ]);

    expect(screen.getByText("체크리스트를 불러오고 있어요.")).toBeTruthy();
    expect(getCurrentUrl()).toBe(
      "/checklist?filter=remaining&taskId=catalog-item-101",
    );

    await act(async () => {
      resolveChecklist(createChecklist("직접 접근한 할 일"));
    });

    expect(
      await screen.findByRole("complementary", {
        name: "직접 접근한 할 일",
      }),
    ).toBeTruthy();
    expect(getCurrentUrl()).toBe(
      "/checklist?filter=remaining&taskId=catalog-item-101",
    );
  });

  it("잘못된 taskId를 로딩 완료 후 replace로 제거한다", async () => {
    let resolveChecklist: (checklist: ChecklistQueryModel) => void = () =>
      undefined;
    repositoryMocks.getChecklist.mockImplementation(
      () =>
        new Promise<ChecklistQueryModel>((resolve) => {
          resolveChecklist = resolve;
        }),
    );
    renderChecklistFeature([
      "/checklist?source=previous",
      "/checklist?filter=remaining&taskId=missing-task",
    ]);

    expect(getCurrentUrl()).toBe(
      "/checklist?filter=remaining&taskId=missing-task",
    );

    await act(async () => {
      resolveChecklist(createChecklist());
    });

    await waitFor(() =>
      expect(getCurrentUrl()).toBe("/checklist?filter=remaining"),
    );
    expect(screen.queryByRole("complementary")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));
    expect(getCurrentUrl()).toBe("/checklist?source=previous");
  });

  it("새 데이터 요청 중에는 taskId를 유지하고 선택 항목이 사라진 결과에서 함께 정리한다", async () => {
    let resolveRefreshedChecklist: (
      checklist: ChecklistQueryModel,
    ) => void = () => undefined;
    repositoryMocks.getChecklist
      .mockResolvedValueOnce(createChecklist("사라질 할 일"))
      .mockImplementationOnce(
        () =>
          new Promise<ChecklistQueryModel>((resolve) => {
            resolveRefreshedChecklist = resolve;
          }),
      );
    const view = renderChecklistFeature([
      "/checklist?filter=remaining&taskId=catalog-item-101",
    ]);
    expect(
      await screen.findByRole("complementary", { name: "사라질 할 일" }),
    ).toBeTruthy();

    repositoryMocks.checklistRevision = 1;
    view.rerender(<ChecklistFeatureTestApp />);
    await waitFor(() =>
      expect(repositoryMocks.getChecklist).toHaveBeenCalledTimes(2),
    );

    expect(getCurrentUrl()).toBe(
      "/checklist?filter=remaining&taskId=catalog-item-101",
    );

    await act(async () => {
      resolveRefreshedChecklist({
        categories: [{ id: "10", items: [], title: "첫 번째 카테고리" }],
      });
    });

    await waitFor(() =>
      expect(getCurrentUrl()).toBe("/checklist?filter=remaining"),
    );
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});

describe("ChecklistFeature 조회 상태와 요청 수명", () => {
  it("Catalog 카테고리가 없으면 전체 빈 상태를 표시한다", async () => {
    repositoryMocks.getChecklist.mockResolvedValue({ categories: [] });

    renderChecklistFeature();

    expect(await screen.findByText("표시할 체크리스트가 없어요.")).toBeTruthy();
  });

  it("항목이 없는 카테고리는 전체 빈 화면 대신 0개와 0%로 표시한다", async () => {
    repositoryMocks.getChecklist.mockResolvedValue({
      categories: [{ id: "10", items: [], title: "빈 카테고리" }],
    });

    renderChecklistFeature();

    const category = (
      await screen.findByRole("heading", { name: "빈 카테고리" })
    ).closest("section");
    expect(category).not.toBeNull();
    expect(within(category!).getByText("0개")).toBeTruthy();
    expect(within(category!).getByText("0%")).toBeTruthy();
    expect(screen.queryByText("표시할 체크리스트가 없어요.")).toBeNull();
  });

  it("일반 오류를 화면 안에서 안내하고 다시 조회한다", async () => {
    repositoryMocks.getChecklist
      .mockRejectedValueOnce(new ChecklistQueryLoadError())
      .mockResolvedValueOnce(createChecklist("재시도 결과"));

    renderChecklistFeature();

    expect(
      await screen.findByText("체크리스트를 불러오지 못했어요."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("재시도 결과")).toBeTruthy();
    expect(repositoryMocks.getChecklist).toHaveBeenCalledTimes(2);
  });

  it("인증 오류를 refreshAuth 흐름에 연결한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockRejectedValue(
      new ChecklistQueryAuthenticationRequiredError(),
    );

    renderChecklistFeature();

    expect(
      await screen.findByText(
        "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.",
      ),
    ).toBeTruthy();
    expect(authMocks.refreshAuth).toHaveBeenCalledOnce();
  });

  it("취소 오류를 사용자 오류로 표시하지 않는다", async () => {
    repositoryMocks.getChecklist.mockRejectedValue(
      new ChecklistQueryRequestAbortedError(),
    );

    renderChecklistFeature();

    await waitFor(() =>
      expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "체크리스트를 불러오고 있어요.",
    );
  });

  it("audience가 바뀌면 이전 요청을 취소하고 오래된 결과를 무시한다", async () => {
    let firstSignal: AbortSignal | undefined;
    let resolveGuest: (value: ChecklistQueryModel) => void = () => undefined;
    let resolveAuthenticated: (value: ChecklistQueryModel) => void = () =>
      undefined;
    repositoryMocks.getChecklist
      .mockImplementationOnce((_audience, signal?: AbortSignal) => {
        firstSignal = signal;
        return new Promise<ChecklistQueryModel>((resolve) => {
          resolveGuest = resolve;
        });
      })
      .mockImplementationOnce(
        () =>
          new Promise<ChecklistQueryModel>((resolve) => {
            resolveAuthenticated = resolve;
          }),
      );
    const view = renderChecklistFeature();
    await waitFor(() => expect(firstSignal).toBeDefined());

    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    view.rerender(<ChecklistFeatureTestApp />);

    expect(firstSignal?.aborted).toBe(true);
    await act(async () => {
      resolveGuest(createChecklist("오래된 guest 결과"));
    });
    expect(screen.queryByText("오래된 guest 결과")).toBeNull();

    await act(async () => {
      resolveAuthenticated(createChecklist("최신 서버 결과"));
    });
    expect(await screen.findByText("최신 서버 결과")).toBeTruthy();
  });

  it("인증 대상의 Repository가 바뀌면 이전 요청을 취소한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "first" },
    };
    let firstSignal: AbortSignal | undefined;
    const firstGetChecklist = vi.fn(
      (_audience: string, signal?: AbortSignal) => {
        firstSignal = signal;
        return new Promise<ChecklistQueryModel>(() => undefined);
      },
    );
    repositoryMocks.current = { getChecklist: firstGetChecklist };
    const view = renderChecklistFeature();
    await waitFor(() => expect(firstSignal).toBeDefined());

    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "second" },
    };
    const secondGetChecklist = vi
      .fn()
      .mockResolvedValue(createChecklist("두 번째 사용자 결과"));
    repositoryMocks.current = { getChecklist: secondGetChecklist };
    view.rerender(<ChecklistFeatureTestApp />);

    expect(firstSignal?.aborted).toBe(true);
    expect(await screen.findByText("두 번째 사용자 결과")).toBeTruthy();
  });

  it("화면에서 제거되면 진행 중 요청을 취소한다", async () => {
    let requestSignal: AbortSignal | undefined;
    repositoryMocks.getChecklist.mockImplementation(
      (_audience, signal?: AbortSignal) => {
        requestSignal = signal;
        return new Promise<ChecklistQueryModel>(() => undefined);
      },
    );
    const view = renderChecklistFeature();
    await waitFor(() => expect(requestSignal).toBeDefined());

    view.unmount();

    expect(requestSignal?.aborted).toBe(true);
  });
});

describe("ChecklistFeature 기존 UI", () => {
  it("카테고리를 기존 순서대로 표시하고 accordion을 열고 닫는다", async () => {
    renderChecklistFeature();
    await screen.findByText("로컬 체크리스트 항목");

    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => within(heading).getByText(/카테고리$/).textContent),
    ).toEqual(["두 번째 카테고리", "첫 번째 카테고리"]);
    const categoryButton = screen.getByRole("button", {
      name: "첫 번째 카테고리",
    });
    expect(categoryButton.getAttribute("aria-expanded")).toBe("true");
    expect(categoryButton.getAttribute("aria-controls")).toBeTruthy();

    fireEvent.click(categoryButton);
    expect(categoryButton.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByRole("list", { name: "첫 번째 카테고리 할 일" }),
    ).toBeNull();

    fireEvent.click(categoryButton);
    expect(categoryButton.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByRole("list", { name: "첫 번째 카테고리 할 일" }),
    ).toBeTruthy();
  });
});
