import { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const analyticsMocks = vi.hoisted(() => ({
  track: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  authState: { status: "guest" } as
    | { status: "authenticated"; user: { id: number; nickname: string } }
    | { status: "guest" }
    | { status: "loading" },
  refreshAuth: vi.fn(),
}));
const repositoryMocks = vi.hoisted(() => ({
  getCatalog: vi.fn(),
}));
const checklistRepositoryMocks = vi.hoisted(() => ({
  addCatalogItemIds: vi.fn(),
  getCatalogItemIds: vi.fn(),
}));

vi.mock("../auth", () => ({
  useAuth: () => ({
    authState: authMocks.authState,
    refreshAuth: authMocks.refreshAuth,
  }),
}));
vi.mock("../checklist/checklistQueryDependencies", () => {
  const repository = {
    getChecklist: vi.fn().mockResolvedValue({ categories: [] }),
  };
  return {
    useChecklistQueryRepository: () => repository,
    useChecklistRevision: () => 0,
  };
});
vi.mock("../../infrastructure/analytics", () => ({
  analytics: {
    initialize: vi.fn(),
    track: analyticsMocks.track,
  },
}));
vi.mock("./preparationDependencies", () => {
  const checklistRepository = {
    addCatalogItemIds: checklistRepositoryMocks.addCatalogItemIds,
    getCatalogItemIds: checklistRepositoryMocks.getCatalogItemIds,
  };

  return {
    usePreparationChecklistRepository: () => checklistRepository,
    preparationCatalogRepository: {
      getCatalog: repositoryMocks.getCatalog,
    },
  };
});

import { AllPreparationStepsFeature } from "./AllPreparationStepsFeature";
import {
  PreparationAuthenticationRequiredError,
  PreparationChecklistAdditionError,
} from "./repository/preparationErrors";
import { preparationCatalogFixture } from "./test/fixtures/preparationCatalog.fixture";

const DESKTOP_ROADMAP_TITLE = "웨딩홀 · 전체 단계";
const ROADMAP_TITLE_PATTERN = / · 전체 단계$/;

async function renderFeature({
  strictMode = false,
  expandFirstStep = false,
} = {}) {
  const feature = <AllPreparationStepsFeature />;
  const page = <div data-page-scroll-container>{feature}</div>;

  const result = render(strictMode ? <StrictMode>{page}</StrictMode> : page);
  await screen.findByRole("heading", { name: ROADMAP_TITLE_PATTERN });
  await waitFor(() =>
    expect(analyticsMocks.track).toHaveBeenCalledWith(
      expect.objectContaining({ name: "preparation_catalog_view" }),
    ),
  );

  if (expandFirstStep) {
    fireEvent.click(
      screen.getByRole("button", { name: /01.*웨딩홀 투어와 계약/ }),
    );
  }
  return result;
}

function getRoadmapTitle() {
  return screen.getByRole("heading", { name: ROADMAP_TITLE_PATTERN });
}

beforeEach(() => {
  checklistRepositoryMocks.addCatalogItemIds.mockReset();
  checklistRepositoryMocks.addCatalogItemIds.mockImplementation(
    (_audience: string, catalogItemIds: string[]) =>
      Promise.resolve([...new Set(catalogItemIds)]),
  );
  checklistRepositoryMocks.getCatalogItemIds.mockReset();
  checklistRepositoryMocks.getCatalogItemIds.mockResolvedValue(["101"]);
});

describe("AllPreparationStepsFeature Analytics", () => {
  beforeEach(() => {
    authMocks.authState = { status: "guest" };
    authMocks.refreshAuth.mockReset();
    analyticsMocks.track.mockReset();
    repositoryMocks.getCatalog.mockReset();
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);
  });

  it("StrictMode에서도 준비 목록 최초 진입 이벤트를 한 번 전송한다", async () => {
    await renderFeature({ strictMode: true });

    await waitFor(() => expect(analyticsMocks.track).toHaveBeenCalledOnce());
    expect(analyticsMocks.track).toHaveBeenCalledWith({
      name: "preparation_catalog_view",
      parameters: {
        initial_category_id: "wedding-hall",
      },
    });
  });

  it("카테고리 버튼 선택 이벤트를 전송한다", async () => {
    await renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "스드메" }));

    expect(analyticsMocks.track).toHaveBeenCalledOnce();
    expect(analyticsMocks.track).toHaveBeenCalledWith({
      name: "preparation_category_select",
      parameters: {
        category_id: "studio-dress-makeup",
        direction: "direct",
        input_method: "button",
        previous_category_id: "wedding-hall",
      },
    });
  });

  it("현재 카테고리 재선택과 열린 단계 접기에는 이벤트를 전송하지 않는다", async () => {
    await renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "웨딩홀" }));
    const firstStepButton = screen.getByRole("button", {
      name: /01.*웨딩홀 투어와 계약/,
    });

    fireEvent.click(firstStepButton);
    analyticsMocks.track.mockClear();
    fireEvent.click(firstStepButton);

    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("로드맵 단계 선택 이벤트를 전송한다", async () => {
    await renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.click(
      screen.getByRole("button", {
        name: /02.*예식 형태·식순·입장 방식 결정/,
      }),
    );

    expect(analyticsMocks.track).toHaveBeenCalledOnce();
    expect(analyticsMocks.track).toHaveBeenCalledWith({
      name: "preparation_step_select",
      parameters: {
        category_id: "wedding-hall",
        step_id: "step-2",
        step_order: 2,
      },
    });
  });

  it("데스크톱에서 세로 스크롤로 카테고리를 변경하지 않는다", async () => {
    await renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.wheel(getRoadmapTitle(), { deltaX: 0, deltaY: 100 });

    expect(analyticsMocks.track).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "웨딩홀", pressed: true }),
    ).toBeTruthy();
  });
});

describe("AllPreparationStepsFeature 서버 상태", () => {
  beforeEach(() => {
    authMocks.authState = { status: "guest" };
    authMocks.refreshAuth.mockReset();
    analyticsMocks.track.mockReset();
    repositoryMocks.getCatalog.mockReset();
  });

  it("응답을 기다리는 동안 로딩 상태를 표시한다", () => {
    repositoryMocks.getCatalog.mockReturnValue(new Promise(() => {}));

    render(<AllPreparationStepsFeature />);

    expect(screen.getByRole("status").textContent).toBe(
      "로드맵을 불러오고 있어요.",
    );
  });

  it("인증 상태가 확정되기 전에는 준비 목록을 요청하지 않는다", () => {
    authMocks.authState = { status: "loading" };

    render(<AllPreparationStepsFeature />);

    expect(screen.getByRole("status").textContent).toBe(
      "로드맵을 불러오고 있어요.",
    );
    expect(repositoryMocks.getCatalog).not.toHaveBeenCalled();
  });

  it("비로그인 사용자도 단일 준비 목록을 요청한다", async () => {
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);

    await renderFeature({ expandFirstStep: true });

    expect(repositoryMocks.getCatalog).toHaveBeenCalledWith(
      expect.any(AbortSignal),
    );
    expect(checklistRepositoryMocks.getCatalogItemIds).toHaveBeenCalledWith(
      "guest",
      expect.any(AbortSignal),
    );
  });

  it("로그인 사용자는 단일 준비 목록과 서버 체크리스트를 요청한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { id: 1, nickname: "bibbidi" },
    };
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);

    await renderFeature({ expandFirstStep: true });

    expect(repositoryMocks.getCatalog).toHaveBeenCalledWith(
      expect.any(AbortSignal),
    );
    expect(checklistRepositoryMocks.getCatalogItemIds).toHaveBeenCalledWith(
      "authenticated",
      expect.any(AbortSignal),
    );
    expect(
      screen
        .getByRole("button", {
          name: "웨딩홀 견적 비교 추가",
        })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("로그인 사용자는 내 체크리스트의 원본 준비 항목 ID로 included를 계산한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { id: 1, nickname: "bibbidi" },
    };
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);
    checklistRepositoryMocks.getCatalogItemIds.mockResolvedValue(["102"]);

    await renderFeature({ expandFirstStep: true });

    expect(screen.getByText("웨딩홀 견적 비교")).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "웨딩홀 견적 비교 추가",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "웨딩홀 투어 추가",
      }),
    ).toBeTruthy();
  });

  it("비로그인 빈 상태에서 로그인하면 인증 조회 동안 로딩 상태를 표시한다", async () => {
    repositoryMocks.getCatalog
      .mockResolvedValueOnce({
        categories: [{ id: "empty", label: "비어 있음" }],
        roadmaps: [{ categoryId: "empty", steps: [] }],
        stepDetails: [],
      })
      .mockReturnValueOnce(new Promise(() => {}));
    const { rerender } = render(<AllPreparationStepsFeature />);
    expect(await screen.findByText("표시할 로드맵이 없어요.")).toBeTruthy();

    authMocks.authState = {
      status: "authenticated",
      user: { id: 1, nickname: "bibbidi" },
    };
    rerender(<AllPreparationStepsFeature />);

    expect(screen.getByRole("status").textContent).toBe(
      "로드맵을 불러오고 있어요.",
    );
    await waitFor(() =>
      expect(repositoryMocks.getCatalog).toHaveBeenLastCalledWith(
        expect.any(AbortSignal),
      ),
    );
  });

  it("비로그인 조회 오류 상태에서 로그인하면 이전 오류를 표시하지 않는다", async () => {
    repositoryMocks.getCatalog
      .mockRejectedValueOnce(new Error("failed"))
      .mockReturnValueOnce(new Promise(() => {}));
    const { rerender } = render(<AllPreparationStepsFeature />);
    expect(await screen.findByText("로드맵을 불러오지 못했어요.")).toBeTruthy();

    authMocks.authState = {
      status: "authenticated",
      user: { id: 1, nickname: "bibbidi" },
    };
    rerender(<AllPreparationStepsFeature />);

    expect(screen.queryByText("로드맵을 불러오지 못했어요.")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "로드맵을 불러오고 있어요.",
    );
  });

  it("authenticated 상태에서 계정이 바뀌면 이전 목록을 즉시 숨기고 다시 조회한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { id: 1, nickname: "A" },
    };
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);
    let resolveNext: ((ids: string[]) => void) | undefined;
    checklistRepositoryMocks.getCatalogItemIds
      .mockResolvedValueOnce(["101"])
      .mockReturnValueOnce(
        new Promise<string[]>((resolve) => {
          resolveNext = resolve;
        }),
      );
    const { rerender } = await renderFeature({ expandFirstStep: true });
    expect(
      within(
        screen.getByRole("region", { name: "이 단계의 체크리스트" }),
      ).getByText("웨딩홀 투어"),
    ).toBeTruthy();

    authMocks.authState = {
      status: "authenticated",
      user: { id: 2, nickname: "B" },
    };
    rerender(
      <div data-page-scroll-container>
        <AllPreparationStepsFeature />
      </div>,
    );

    expect(
      screen.queryByRole("region", { name: "이 단계의 체크리스트" }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: ROADMAP_TITLE_PATTERN }),
    ).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "로드맵을 불러오고 있어요.",
    );
    expect(checklistRepositoryMocks.getCatalogItemIds).toHaveBeenCalledTimes(2);
    await act(async () => resolveNext?.(["102"]));
    fireEvent.click(
      screen.getByRole("button", { name: /01.*웨딩홀 투어와 계약/ }),
    );
    const checklist = within(
      screen.getByRole("region", { name: "이 단계의 체크리스트" }),
    );
    expect(checklist.getByText("웨딩홀 견적 비교")).toBeTruthy();
    expect(checklist.queryByText("웨딩홀 투어")).toBeNull();
  });

  it("계정 전환 후 늦게 도착한 이전 계정의 조회 응답을 무시한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { id: 1, nickname: "A" },
    };
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);
    let resolvePrevious: ((ids: string[]) => void) | undefined;
    let previousSignal: AbortSignal | undefined;
    checklistRepositoryMocks.getCatalogItemIds
      .mockImplementationOnce((_audience: string, signal: AbortSignal) => {
        previousSignal = signal;
        return new Promise<string[]>((resolve) => {
          resolvePrevious = resolve;
        });
      })
      .mockResolvedValueOnce(["102"]);
    const { rerender } = render(<AllPreparationStepsFeature />);
    authMocks.authState = {
      status: "authenticated",
      user: { id: 2, nickname: "B" },
    };
    rerender(<AllPreparationStepsFeature />);
    expect(previousSignal?.aborted).toBe(true);
    await screen.findByRole("heading", { name: ROADMAP_TITLE_PATTERN });
    await act(async () => resolvePrevious?.(["101"]));
    fireEvent.click(
      screen.getByRole("button", { name: /01.*웨딩홀 투어와 계약/ }),
    );
    const checklist = within(
      screen.getByRole("region", { name: "이 단계의 체크리스트" }),
    );
    expect(checklist.getByText("웨딩홀 견적 비교")).toBeTruthy();
    expect(checklist.queryByText("웨딩홀 투어")).toBeNull();
  });

  it("화면에서 제거되면 진행 중인 요청을 취소한다", () => {
    let requestSignal: AbortSignal | undefined;
    repositoryMocks.getCatalog.mockImplementation((signal?: AbortSignal) => {
      requestSignal = signal;
      return new Promise(() => {});
    });

    const { unmount } = render(<AllPreparationStepsFeature />);
    expect(requestSignal?.aborted).toBe(false);

    unmount();

    expect(requestSignal?.aborted).toBe(true);
  });

  it("준비 단계가 없으면 빈 상태를 표시한다", async () => {
    repositoryMocks.getCatalog.mockResolvedValue({
      categories: [{ id: "empty", label: "비어 있음" }],
      roadmaps: [{ categoryId: "empty", steps: [] }],
      stepDetails: [],
    });

    render(<AllPreparationStepsFeature />);

    expect(await screen.findByText("표시할 로드맵이 없어요.")).toBeTruthy();
    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("조회 실패를 안내하고 다시 시도할 수 있다", async () => {
    repositoryMocks.getCatalog
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce(preparationCatalogFixture);

    render(<AllPreparationStepsFeature />);

    expect(await screen.findByText("로드맵을 불러오지 못했어요.")).toBeTruthy();
    expect(authMocks.refreshAuth).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(
      await screen.findByRole("heading", { name: DESKTOP_ROADMAP_TITLE }),
    ).toBeTruthy();
    expect(repositoryMocks.getCatalog).toHaveBeenCalledTimes(2);
  });

  it("내 체크리스트의 401 응답을 로그인 만료로 안내한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { id: 1, nickname: "bibbidi" },
    };
    checklistRepositoryMocks.getCatalogItemIds.mockRejectedValue(
      new PreparationAuthenticationRequiredError(),
    );

    render(<AllPreparationStepsFeature />);

    expect(
      await screen.findByText(
        "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.",
      ),
    ).toBeTruthy();
    expect(authMocks.refreshAuth).toHaveBeenCalledOnce();
  });

  it("인증 상태 재조회 중에도 로그인 만료 안내에서 다시 시도할 수 있다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { id: 1, nickname: "bibbidi" },
    };
    checklistRepositoryMocks.getCatalogItemIds.mockRejectedValue(
      new PreparationAuthenticationRequiredError(),
    );
    const { rerender } = render(<AllPreparationStepsFeature />);
    await screen.findByText(
      "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.",
    );

    authMocks.authState = { status: "loading" };
    rerender(<AllPreparationStepsFeature />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(authMocks.refreshAuth).toHaveBeenCalledTimes(2);
  });
});

describe("AllPreparationStepsFeature 로그인 체크리스트 추가", () => {
  beforeEach(() => {
    authMocks.authState = {
      status: "authenticated",
      user: { id: 1, nickname: "bibbidi" },
    };
    authMocks.refreshAuth.mockReset();
    analyticsMocks.track.mockReset();
    repositoryMocks.getCatalog.mockReset();
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("개별 할 일을 서버 체크리스트에 추가하고 즉시 화면에 반영한다", async () => {
    checklistRepositoryMocks.addCatalogItemIds.mockResolvedValueOnce(["102"]);
    await renderFeature({ expandFirstStep: true });
    analyticsMocks.track.mockClear();

    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );

    expect(checklistRepositoryMocks.addCatalogItemIds).toHaveBeenCalledWith(
      "authenticated",
      ["102"],
      expect.any(AbortSignal),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "웨딩홀 견적 비교 추가" }),
      ).toBeNull(),
    );
    expect(screen.getByText("2개")).toBeTruthy();
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
    expect(analyticsMocks.track).toHaveBeenCalledWith({
      name: "preparation_item_add",
      parameters: {
        category_id: "wedding-hall",
        item_count: 1,
        source: "preparation",
        step_id: "step-1",
        step_order: 1,
      },
    });
  });

  it("현재 단계의 남은 할 일을 서버 체크리스트에 모두 추가한다", async () => {
    checklistRepositoryMocks.addCatalogItemIds.mockResolvedValueOnce(["102"]);
    await renderFeature({ expandFirstStep: true });

    fireEvent.click(screen.getByRole("button", { name: "모두 추가" }));

    expect(checklistRepositoryMocks.addCatalogItemIds).toHaveBeenCalledWith(
      "authenticated",
      ["102"],
      expect.any(AbortSignal),
    );
    expect(
      await screen.findByText("추가할 수 있는 할 일이 없어요."),
    ).toBeTruthy();
    expect(
      screen.getByText("이 단계의 모든 할 일을 체크리스트에 추가했어요."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /모두 추가/,
      }),
    ).toBeNull();
  });

  it("추가 요청 중 버튼을 잠가 중복 요청을 막는다", async () => {
    let resolveAddition: ((catalogItemIds: string[]) => void) | undefined;
    checklistRepositoryMocks.addCatalogItemIds.mockReturnValueOnce(
      new Promise<string[]>((resolve) => {
        resolveAddition = resolve;
      }),
    );
    await renderFeature({ expandFirstStep: true });
    analyticsMocks.track.mockClear();
    const addButton = screen.getByRole("button", {
      name: "웨딩홀 견적 비교 추가",
    });

    fireEvent.click(addButton);
    fireEvent.click(addButton);

    expect(checklistRepositoryMocks.addCatalogItemIds).toHaveBeenCalledOnce();
    expect(
      screen
        .getByRole("button", { name: "웨딩홀 견적 비교 추가 중" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "모두 추가 중" })
        .hasAttribute("disabled"),
    ).toBe(true);

    await act(async () => resolveAddition?.(["102"]));
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
  });

  it("인증 대상이 바뀌면 진행 중인 추가 작업을 취소한다", async () => {
    let additionSignal: AbortSignal | undefined;
    let resolveAddition: ((catalogItemIds: string[]) => void) | undefined;
    checklistRepositoryMocks.addCatalogItemIds.mockImplementationOnce(
      (_audience: string, _catalogItemIds: string[], signal?: AbortSignal) => {
        additionSignal = signal;
        return new Promise<string[]>((resolve) => {
          resolveAddition = resolve;
        });
      },
    );
    const { rerender } = await renderFeature({ expandFirstStep: true });
    analyticsMocks.track.mockClear();

    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );
    expect(additionSignal?.aborted).toBe(false);

    authMocks.authState = { status: "guest" };
    rerender(
      <div data-page-scroll-container>
        <AllPreparationStepsFeature />
      </div>,
    );

    expect(additionSignal?.aborted).toBe(true);
    await act(async () => resolveAddition?.(["102"]));
    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("authenticated 상태에서 계정이 바뀌면 이전 담기를 취소하고 새 계정은 담기를 계속할 수 있다", async () => {
    let previousSignal: AbortSignal | undefined;
    let resolvePrevious: ((ids: string[]) => void) | undefined;
    checklistRepositoryMocks.addCatalogItemIds.mockImplementationOnce(
      (_audience: string, _ids: string[], signal: AbortSignal) => {
        previousSignal = signal;
        return new Promise<string[]>((resolve) => {
          resolvePrevious = resolve;
        });
      },
    );
    const { rerender } = await renderFeature({ expandFirstStep: true });
    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );
    authMocks.authState = {
      status: "authenticated",
      user: { id: 2, nickname: "B" },
    };
    rerender(
      <div data-page-scroll-container>
        <AllPreparationStepsFeature />
      </div>,
    );
    expect(previousSignal?.aborted).toBe(true);
    await screen.findByRole("heading", { name: ROADMAP_TITLE_PATTERN });
    fireEvent.click(
      screen.getByRole("button", { name: /01.*웨딩홀 투어와 계약/ }),
    );
    const button = screen.getByRole("button", {
      name: "웨딩홀 견적 비교 추가",
    });
    expect(button.hasAttribute("disabled")).toBe(false);
    analyticsMocks.track.mockClear();
    await act(async () => resolvePrevious?.(["102"]));
    expect(analyticsMocks.track).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    ).toBeTruthy();
    fireEvent.click(button);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "웨딩홀 견적 비교 추가" }),
      ).toBeNull(),
    );
    expect(checklistRepositoryMocks.addCatalogItemIds).toHaveBeenCalledTimes(2);
  });

  it("추가 실패 시 화면을 유지하고 같은 동작을 다시 시도한다", async () => {
    checklistRepositoryMocks.addCatalogItemIds
      .mockRejectedValueOnce(
        new PreparationChecklistAdditionError("이미 추가된 준비 항목입니다."),
      )
      .mockResolvedValueOnce(["102"]);
    await renderFeature({ expandFirstStep: true });
    analyticsMocks.track.mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "이미 추가된 준비 항목입니다.",
    );
    expect(analyticsMocks.track).not.toHaveBeenCalled();
    const retryButton = screen.getByRole("button", {
      name: "웨딩홀 견적 비교 추가",
    });
    expect(retryButton.hasAttribute("disabled")).toBe(false);

    fireEvent.click(retryButton);

    await waitFor(() =>
      expect(checklistRepositoryMocks.addCatalogItemIds).toHaveBeenCalledTimes(
        2,
      ),
    );
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
  });

  it("서버가 실제로 추가한 항목이 없으면 성공 이벤트를 전송하지 않는다", async () => {
    checklistRepositoryMocks.addCatalogItemIds.mockResolvedValueOnce([]);
    await renderFeature({ expandFirstStep: true });
    analyticsMocks.track.mockClear();

    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );

    await waitFor(() =>
      expect(checklistRepositoryMocks.addCatalogItemIds).toHaveBeenCalledOnce(),
    );
    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("추가 요청의 인증 만료를 인증 상태 재조회로 연결한다", async () => {
    checklistRepositoryMocks.addCatalogItemIds.mockRejectedValueOnce(
      new PreparationAuthenticationRequiredError(),
    );
    await renderFeature({ expandFirstStep: true });

    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );

    await waitFor(() => expect(authMocks.refreshAuth).toHaveBeenCalledOnce());
  });
});

describe("AllPreparationStepsFeature 비로그인 체크리스트", () => {
  beforeEach(() => {
    authMocks.authState = { status: "guest" };
    authMocks.refreshAuth.mockReset();
    analyticsMocks.track.mockReset();
    repositoryMocks.getCatalog.mockReset();
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("로컬에 저장된 항목을 공개 준비 목록의 체크리스트로 복원한다", async () => {
    checklistRepositoryMocks.getCatalogItemIds.mockResolvedValue(["102"]);

    await renderFeature({ expandFirstStep: true });

    expect(screen.getByText("웨딩홀 견적 비교")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "웨딩홀 투어 추가" }),
    ).toBeTruthy();
  });

  it("로컬 저장소 읽기 실패를 안내하고 다시 조회할 수 있다", async () => {
    checklistRepositoryMocks.getCatalogItemIds
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockResolvedValueOnce(["101"]);

    render(<AllPreparationStepsFeature />);

    expect(await screen.findByText("로드맵을 불러오지 못했어요.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(
      await screen.findByRole("heading", { name: DESKTOP_ROADMAP_TITLE }),
    ).toBeTruthy();
    expect(repositoryMocks.getCatalog).toHaveBeenCalledTimes(2);
    expect(checklistRepositoryMocks.getCatalogItemIds).toHaveBeenCalledTimes(2);
  });

  it("개별 할 일을 로컬 체크리스트에 추가하고 즉시 화면에 반영한다", async () => {
    await renderFeature({ expandFirstStep: true });
    analyticsMocks.track.mockClear();

    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );

    expect(checklistRepositoryMocks.addCatalogItemIds).toHaveBeenCalledWith(
      "guest",
      ["102"],
      expect.any(AbortSignal),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "웨딩홀 견적 비교 추가" }),
      ).toBeNull(),
    );
    expect(screen.getByText("2개")).toBeTruthy();
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
    expect(analyticsMocks.track).toHaveBeenCalledWith({
      name: "preparation_item_add",
      parameters: {
        category_id: "wedding-hall",
        item_count: 1,
        source: "preparation",
        step_id: "step-1",
        step_order: 1,
      },
    });
  });

  it("현재 단계의 남은 할 일을 모두 로컬 체크리스트에 추가한다", async () => {
    await renderFeature({ expandFirstStep: true });

    fireEvent.click(screen.getByRole("button", { name: "모두 추가" }));

    expect(checklistRepositoryMocks.addCatalogItemIds).toHaveBeenCalledWith(
      "guest",
      ["102"],
      expect.any(AbortSignal),
    );
    expect(
      await screen.findByText("추가할 수 있는 할 일이 없어요."),
    ).toBeTruthy();
    expect(
      screen.getByText("이 단계의 모든 할 일을 체크리스트에 추가했어요."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /모두 추가/,
      }),
    ).toBeNull();
  });

  it("로컬 저장 실패 시 화면을 유지하고 같은 동작을 다시 시도할 수 있다", async () => {
    checklistRepositoryMocks.addCatalogItemIds
      .mockImplementationOnce(() => {
        throw new Error("storage unavailable");
      })
      .mockReturnValueOnce(["102"]);
    await renderFeature({ expandFirstStep: true });
    analyticsMocks.track.mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "할 일을 저장하지 못했어요. 다시 시도해 주세요.",
    );
    expect(analyticsMocks.track).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );

    expect(checklistRepositoryMocks.addCatalogItemIds).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    ).toBeNull();
    await waitFor(() => expect(analyticsMocks.track).toHaveBeenCalledOnce());
  });

  it("모바일 인라인 상세에서도 개별 할 일을 추가하고 펼친 상태를 유지한다", async () => {
    await renderFeature();
    fireEvent.click(
      screen.getByRole("button", { name: /01.*웨딩홀 투어와 계약/ }),
    );
    const detail = screen.getByRole("complementary", {
      name: "이 단계에서 준비할 일",
    });

    fireEvent.click(
      within(detail).getByRole("button", {
        name: "웨딩홀 견적 비교 추가",
      }),
    );

    expect(checklistRepositoryMocks.addCatalogItemIds).toHaveBeenCalledWith(
      "guest",
      ["102"],
      expect.any(AbortSignal),
    );
    await waitFor(() =>
      expect(
        within(detail).queryByRole("button", {
          name: "웨딩홀 견적 비교 추가",
        }),
      ).toBeNull(),
    );
    expect(
      screen.getByRole("button", {
        expanded: true,
        name: /01.*웨딩홀 투어와 계약/,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toBe(detail);
  });

  it("모바일에서 남은 할 일을 모두 추가하면 빈 상태를 안내하고 전체 추가 버튼을 숨긴다", async () => {
    await renderFeature();
    fireEvent.click(
      screen.getByRole("button", { name: /01.*웨딩홀 투어와 계약/ }),
    );
    const detail = screen.getByRole("complementary", {
      name: "이 단계에서 준비할 일",
    });

    fireEvent.click(
      within(detail).getByRole("button", {
        name: "모두 추가",
      }),
    );

    expect(
      await within(detail).findByText("추가할 수 있는 할 일이 없어요."),
    ).toBeTruthy();
    expect(
      within(detail).getByText(
        "이 단계의 모든 할 일을 체크리스트에 추가했어요.",
      ),
    ).toBeTruthy();
    expect(
      within(detail).queryByRole("button", {
        name: /모두 추가/,
      }),
    ).toBeNull();
  });
});

describe("AllPreparationStepsFeature 목록 상세", () => {
  beforeEach(() => {
    authMocks.authState = { status: "guest" };
    analyticsMocks.track.mockReset();
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);
  });

  it("최초 진입 시 상세를 자동으로 펼치지 않는다", async () => {
    await renderFeature();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: /01.*웨딩홀 투어와 계약/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("카드 아래에 추가할 일과 내가 담은 일을 펼쳐 표시한다", async () => {
    await renderFeature({ expandFirstStep: true });
    const detail = screen.getByRole("complementary", {
      name: "이 단계에서 준비할 일",
    });
    expect(
      within(detail).getByRole("heading", { name: "아직 안 담은 일" }),
    ).toBeTruthy();
    expect(
      within(detail).getByRole("heading", { name: "내가 담은 일" }),
    ).toBeTruthy();
    expect(within(detail).getByText("웨딩홀 투어")).toBeTruthy();
    expect(
      within(detail).getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    ).toBeTruthy();
    expect(
      within(detail)
        .getByRole("link", { name: "내 체크리스트 보기" })
        .getAttribute("href"),
    ).toBe("/checklist");
  });

  it("같은 카드를 다시 누르면 상세를 접는다", async () => {
    await renderFeature({ expandFirstStep: true });
    fireEvent.click(
      screen.getByRole("button", { name: /01.*웨딩홀 투어와 계약/ }),
    );
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("접기 버튼은 단계 카드로 포커스를 돌려준다", async () => {
    await renderFeature({ expandFirstStep: true });
    fireEvent.click(screen.getByRole("button", { name: "할 일 접기" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /01.*웨딩홀 투어와 계약/ }),
    );
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("다른 단계를 누르면 새 상세를 펼치고 빈 체크리스트를 안내한다", async () => {
    await renderFeature({ expandFirstStep: true });
    fireEvent.click(
      screen.getByRole("button", { name: /02.*예식 형태·식순·입장 방식 결정/ }),
    );
    expect(screen.getAllByRole("complementary")).toHaveLength(1);
    expect(screen.getByText("이 단계에 추가한 할 일이 없어요.")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: /01.*웨딩홀 투어와 계약/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("카테고리 변경 시 목록 스크롤과 상세를 초기화하고 페이지는 유지한다", async () => {
    await renderFeature({ expandFirstStep: true });
    const list = screen.getByRole("region", { name: "전체 단계 목록" });
    const page = document.querySelector<HTMLElement>(
      "[data-page-scroll-container]",
    )!;
    list.scrollTop = 400;
    page.scrollTop = 120;
    fireEvent.click(screen.getByRole("button", { name: "스드메" }));
    expect(list.scrollTop).toBe(0);
    expect(page.scrollTop).toBe(120);
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});
