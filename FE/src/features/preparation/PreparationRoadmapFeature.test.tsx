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
    | { status: "authenticated"; user: { nickname: string } }
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

import { PreparationRoadmapFeature } from "./PreparationRoadmapFeature";
import {
  PreparationAuthenticationRequiredError,
  PreparationChecklistAdditionError,
} from "./repository/preparationErrors";
import { preparationCatalogFixture } from "./test/fixtures/preparationCatalog.fixture";

const DESKTOP_ROADMAP_TITLE = "필요한 일만 골라 나만의 체크리스트로";
const ROADMAP_TITLE_PATTERN =
  /^(준비 로드맵|필요한 일만 골라 나만의 체크리스트로)$/;

async function renderFeature({ strictMode = false } = {}) {
  const feature = <PreparationRoadmapFeature />;
  const page = <div data-page-scroll-container>{feature}</div>;

  const result = render(strictMode ? <StrictMode>{page}</StrictMode> : page);
  await screen.findByRole("heading", { name: ROADMAP_TITLE_PATTERN });
  await waitFor(() =>
    expect(analyticsMocks.track).toHaveBeenCalledWith(
      expect.objectContaining({ name: "preparation_catalog_view" }),
    ),
  );

  return result;
}

function getRoadmapTitle() {
  return screen.getByRole("heading", { name: ROADMAP_TITLE_PATTERN });
}

const COMPACT_LAYOUT_MEDIA_QUERY = "(max-width: 1199px)";
const MOBILE_LAYOUT_MEDIA_QUERY = "(max-width: 760px)";

beforeEach(() => {
  checklistRepositoryMocks.addCatalogItemIds.mockReset();
  checklistRepositoryMocks.addCatalogItemIds.mockImplementation(
    (_audience: string, catalogItemIds: string[]) =>
      Promise.resolve([...new Set(catalogItemIds)]),
  );
  checklistRepositoryMocks.getCatalogItemIds.mockReset();
  checklistRepositoryMocks.getCatalogItemIds.mockResolvedValue(["101"]);
});

interface ViewportMatches {
  compact: boolean;
  mobile: boolean;
}

function normalizeViewportMatches(
  matches: boolean | ViewportMatches,
): ViewportMatches {
  return typeof matches === "boolean"
    ? { compact: matches, mobile: matches }
    : matches;
}

function setViewportMatches(initialMatches: boolean | ViewportMatches = true) {
  const listenersByMedia = new Map<
    string,
    Set<(event: MediaQueryListEvent) => void>
  >();
  let matchesByMedia = new Map<string, boolean>();

  const updateMatches = (matches: ViewportMatches) => {
    matchesByMedia = new Map([
      [COMPACT_LAYOUT_MEDIA_QUERY, matches.compact],
      [MOBILE_LAYOUT_MEDIA_QUERY, matches.mobile],
    ]);
  };

  updateMatches(normalizeViewportMatches(initialMatches));

  const matchMedia = vi
    .fn()
    .mockImplementation((media: string): MediaQueryList => {
      const listeners = listenersByMedia.get(media) ?? new Set();
      listenersByMedia.set(media, listeners);

      return {
        addEventListener: (
          _type: string,
          listener: EventListenerOrEventListenerObject,
        ) => {
          listeners.add(listener as (event: MediaQueryListEvent) => void);
        },
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        get matches() {
          return matchesByMedia.get(media) ?? false;
        },
        media,
        onchange: null,
        removeEventListener: (
          _type: string,
          listener: EventListenerOrEventListenerObject,
        ) => {
          listeners.delete(listener as (event: MediaQueryListEvent) => void);
        },
        removeListener: vi.fn(),
      };
    });

  vi.stubGlobal("matchMedia", matchMedia);

  return {
    change(matchesNext: boolean | ViewportMatches) {
      const normalizedMatches = normalizeViewportMatches(matchesNext);
      updateMatches(normalizedMatches);

      const changedMatches: [string, boolean][] = [
        [COMPACT_LAYOUT_MEDIA_QUERY, normalizedMatches.compact],
        [MOBILE_LAYOUT_MEDIA_QUERY, normalizedMatches.mobile],
      ];

      changedMatches.forEach(([media, matches]) => {
        listenersByMedia
          .get(media)
          ?.forEach((listener) => listener({ matches } as MediaQueryListEvent));
      });
    },
  };
}

describe("PreparationRoadmapFeature Analytics", () => {
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

  it("현재 카테고리와 단계를 다시 선택하면 이벤트를 전송하지 않는다", async () => {
    await renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "웨딩홀" }));
    const firstStepButton = screen.getByRole("button", {
      name: /01.*웨딩홀 투어와 계약/,
    });

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
    setViewportMatches(false);
    await renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.wheel(getRoadmapTitle(), { deltaX: 0, deltaY: 100 });

    expect(analyticsMocks.track).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "웨딩홀", pressed: true }),
    ).toBeTruthy();
  });
});

describe("PreparationRoadmapFeature 서버 상태", () => {
  beforeEach(() => {
    authMocks.authState = { status: "guest" };
    authMocks.refreshAuth.mockReset();
    analyticsMocks.track.mockReset();
    repositoryMocks.getCatalog.mockReset();
  });

  it("응답을 기다리는 동안 로딩 상태를 표시한다", () => {
    repositoryMocks.getCatalog.mockReturnValue(new Promise(() => {}));

    render(<PreparationRoadmapFeature />);

    expect(screen.getByRole("status").textContent).toBe(
      "준비 목록을 불러오고 있어요.",
    );
  });

  it("인증 상태가 확정되기 전에는 준비 목록을 요청하지 않는다", () => {
    authMocks.authState = { status: "loading" };

    render(<PreparationRoadmapFeature />);

    expect(screen.getByRole("status").textContent).toBe(
      "준비 목록을 불러오고 있어요.",
    );
    expect(repositoryMocks.getCatalog).not.toHaveBeenCalled();
  });

  it("비로그인 사용자도 단일 준비 목록을 요청한다", async () => {
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);

    await renderFeature();

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
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);

    await renderFeature();

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
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);
    checklistRepositoryMocks.getCatalogItemIds.mockResolvedValue(["102"]);

    await renderFeature();

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
    const { rerender } = render(<PreparationRoadmapFeature />);
    expect(await screen.findByText("표시할 준비 목록이 없어요.")).toBeTruthy();

    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    rerender(<PreparationRoadmapFeature />);

    expect(screen.getByRole("status").textContent).toBe(
      "준비 목록을 불러오고 있어요.",
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
    const { rerender } = render(<PreparationRoadmapFeature />);
    expect(
      await screen.findByText("준비 목록을 불러오지 못했어요."),
    ).toBeTruthy();

    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    rerender(<PreparationRoadmapFeature />);

    expect(screen.queryByText("준비 목록을 불러오지 못했어요.")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "준비 목록을 불러오고 있어요.",
    );
  });

  it("화면에서 제거되면 진행 중인 요청을 취소한다", () => {
    let requestSignal: AbortSignal | undefined;
    repositoryMocks.getCatalog.mockImplementation((signal?: AbortSignal) => {
      requestSignal = signal;
      return new Promise(() => {});
    });

    const { unmount } = render(<PreparationRoadmapFeature />);
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

    render(<PreparationRoadmapFeature />);

    expect(await screen.findByText("표시할 준비 목록이 없어요.")).toBeTruthy();
    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("조회 실패를 안내하고 다시 시도할 수 있다", async () => {
    repositoryMocks.getCatalog
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce(preparationCatalogFixture);

    render(<PreparationRoadmapFeature />);

    expect(
      await screen.findByText("준비 목록을 불러오지 못했어요."),
    ).toBeTruthy();
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
      user: { nickname: "bibbidi" },
    };
    checklistRepositoryMocks.getCatalogItemIds.mockRejectedValue(
      new PreparationAuthenticationRequiredError(),
    );

    render(<PreparationRoadmapFeature />);

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
      user: { nickname: "bibbidi" },
    };
    checklistRepositoryMocks.getCatalogItemIds.mockRejectedValue(
      new PreparationAuthenticationRequiredError(),
    );
    const { rerender } = render(<PreparationRoadmapFeature />);
    await screen.findByText(
      "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.",
    );

    authMocks.authState = { status: "loading" };
    rerender(<PreparationRoadmapFeature />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(authMocks.refreshAuth).toHaveBeenCalledTimes(2);
  });
});

describe("PreparationRoadmapFeature 로그인 체크리스트 추가", () => {
  beforeEach(() => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    authMocks.refreshAuth.mockReset();
    analyticsMocks.track.mockReset();
    repositoryMocks.getCatalog.mockReset();
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);
    setViewportMatches(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("개별 할 일을 서버 체크리스트에 추가하고 즉시 화면에 반영한다", async () => {
    checklistRepositoryMocks.addCatalogItemIds.mockResolvedValueOnce(["102"]);
    await renderFeature();
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
    await renderFeature();

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
    await renderFeature();
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
    const { rerender } = await renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );
    expect(additionSignal?.aborted).toBe(false);

    authMocks.authState = { status: "guest" };
    rerender(
      <div data-page-scroll-container>
        <PreparationRoadmapFeature />
      </div>,
    );

    expect(additionSignal?.aborted).toBe(true);
    await act(async () => resolveAddition?.(["102"]));
    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("추가 실패 시 화면을 유지하고 같은 동작을 다시 시도한다", async () => {
    checklistRepositoryMocks.addCatalogItemIds
      .mockRejectedValueOnce(
        new PreparationChecklistAdditionError("이미 추가된 준비 항목입니다."),
      )
      .mockResolvedValueOnce(["102"]);
    await renderFeature();
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
    await renderFeature();
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
    await renderFeature();

    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );

    await waitFor(() => expect(authMocks.refreshAuth).toHaveBeenCalledOnce());
  });
});

describe("PreparationRoadmapFeature 비로그인 체크리스트", () => {
  beforeEach(() => {
    authMocks.authState = { status: "guest" };
    authMocks.refreshAuth.mockReset();
    analyticsMocks.track.mockReset();
    repositoryMocks.getCatalog.mockReset();
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);
    setViewportMatches(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("로컬에 저장된 항목을 공개 준비 목록의 체크리스트로 복원한다", async () => {
    checklistRepositoryMocks.getCatalogItemIds.mockResolvedValue(["102"]);

    await renderFeature();

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

    render(<PreparationRoadmapFeature />);

    expect(
      await screen.findByText("준비 목록을 불러오지 못했어요."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(
      await screen.findByRole("heading", { name: DESKTOP_ROADMAP_TITLE }),
    ).toBeTruthy();
    expect(repositoryMocks.getCatalog).toHaveBeenCalledTimes(2);
    expect(checklistRepositoryMocks.getCatalogItemIds).toHaveBeenCalledTimes(2);
  });

  it("개별 할 일을 로컬 체크리스트에 추가하고 즉시 화면에 반영한다", async () => {
    await renderFeature();
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
    await renderFeature();

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
    await renderFeature();
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

  it("모바일 바텀시트에서도 개별 할 일을 추가한다", async () => {
    setViewportMatches(true);
    await renderFeature();
    fireEvent.click(
      screen.getByRole("button", { name: /01.*웨딩홀 투어와 계약/ }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "웨딩홀 투어와 계약",
    });

    fireEvent.click(
      within(dialog).getByRole("button", {
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
        within(dialog).queryByRole("button", {
          name: "웨딩홀 견적 비교 추가",
        }),
      ).toBeNull(),
    );
  });

  it("모바일에서 남은 할 일을 모두 추가하면 빈 상태를 안내하고 전체 추가 버튼을 숨긴다", async () => {
    setViewportMatches(true);
    await renderFeature();
    fireEvent.click(
      screen.getByRole("button", { name: /01.*웨딩홀 투어와 계약/ }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "웨딩홀 투어와 계약",
    });

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "남은 할 일 모두 추가",
      }),
    );

    expect(
      await within(dialog).findByText("추가할 수 있는 할 일이 없어요."),
    ).toBeTruthy();
    expect(
      within(dialog).getByText(
        "이 단계의 모든 할 일을 체크리스트에 추가했어요.",
      ),
    ).toBeTruthy();
    expect(
      within(dialog).queryByRole("button", {
        name: /남은 할 일 모두 추가/,
      }),
    ).toBeNull();
  });
});

describe("PreparationRoadmapFeature 반응형 상세 패널", () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    authMocks.authState = { status: "guest" };
    analyticsMocks.track.mockReset();
    repositoryMocks.getCatalog.mockResolvedValue(preparationCatalogFixture);
    scrollIntoViewMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    vi.unstubAllGlobals();
  });

  it("로드맵 상세 패널에서는 중복되는 카테고리 라벨을 표시하지 않는다", async () => {
    setViewportMatches(false);
    await renderFeature();

    const detail = screen.getByRole("complementary", {
      name: "이 단계에서 준비할 일",
    });

    expect(within(detail).queryByText("웨딩홀")).toBeNull();
  });

  it("데스크톱 최초 진입 시에는 초기 단계 상세 패널을 표시한다", async () => {
    setViewportMatches(false);
    await renderFeature();

    expect(
      screen.getByRole("heading", { name: DESKTOP_ROADMAP_TITLE }),
    ).toBeTruthy();
    const guide = screen.getByRole("list", {
      name: "체크리스트 만드는 순서",
    });
    expect(within(guide).getByText("단계 선택")).toBeTruthy();
    expect(within(guide).getByText("할 일 추가")).toBeTruthy();
    expect(within(guide).getByText("체크리스트에서 관리")).toBeTruthy();

    expect(
      screen.getByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toBeTruthy();
    const selectedStep = screen.getByRole("button", {
      name: /01.*웨딩홀 투어와 계약/,
      pressed: true,
    });

    expect(selectedStep.getAttribute("aria-controls")).toBe(
      "preparation-step-detail",
    );
    expect(selectedStep.hasAttribute("aria-haspopup")).toBe(false);
    const detail = screen.getByRole("complementary", {
      name: "이 단계에서 준비할 일",
    });
    expect(within(detail).getByText("01")).toBeTruthy();
    expect(within(detail).queryByText("선택한 로드맵 단계")).toBeNull();
    expect(
      within(detail).getByRole("heading", { name: "웨딩홀 투어와 계약" }),
    ).toBeTruthy();
    expect(
      within(detail).getByRole("heading", {
        name: "아직 안 담은 일",
      }),
    ).toBeTruthy();
    expect(
      within(detail).getByRole("heading", { name: "내가 담은 일" }),
    ).toBeTruthy();
    expect(screen.getByText("웨딩홀 투어")).toBeTruthy();
    expect(
      screen
        .getByRole("button", {
          name: "웨딩홀 견적 비교 추가",
        })
        .hasAttribute("disabled"),
    ).toBe(false);
    expect(screen.getByText("필수")).toBeTruthy();
    const addAllButton = screen.getByRole("button", {
      name: "모두 추가",
    });
    expect(addAllButton.hasAttribute("disabled")).toBe(false);
    const checklist = screen.getByRole("region", {
      name: "이 단계의 체크리스트",
    });
    expect(within(checklist).getByText("1개")).toBeTruthy();
    expect(
      within(checklist)
        .getByRole("link", { name: "내 체크리스트 보기" })
        .getAttribute("href"),
    ).toBe("/checklist");
    expect(
      checklist.parentElement?.classList.contains(
        "preparation-step-detail__columns",
      ),
    ).toBe(true);
    expect(
      detail.parentElement?.classList.contains("preparation-roadmap__content"),
    ).toBe(true);
  });

  it("데스크톱에서 추가 전과 추가한 일을 나란히 표시한다", async () => {
    setViewportMatches(false);
    await renderFeature();

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
    expect(within(detail).getByText("웨딩홀 견적 비교")).toBeTruthy();
  });

  it("데스크톱에서 선택한 단계의 체크리스트가 비어 있으면 안내한다", async () => {
    setViewportMatches(false);
    await renderFeature();

    fireEvent.click(
      screen.getByRole("button", {
        name: /02.*예식 형태·식순·입장 방식 결정/,
      }),
    );

    expect(screen.getByRole("heading", { name: "내가 담은 일" })).toBeTruthy();
    expect(screen.getByText("이 단계에 추가한 할 일이 없어요.")).toBeTruthy();
  });

  it("단계 카드에는 중복되는 상세 설명을 표시하지 않는다", async () => {
    setViewportMatches(false);
    await renderFeature();

    const firstStepButton = screen.getByRole("button", {
      name: "01 웨딩홀 투어와 계약",
    });

    expect(
      firstStepButton.querySelector(".preparation-roadmap__step-description"),
    ).toBeNull();
    expect(
      firstStepButton.querySelector(".preparation-roadmap__step-title")
        ?.textContent,
    ).toBe("웨딩홀 투어와 계약");
    const icon = firstStepButton.querySelector<HTMLImageElement>(
      ".preparation-roadmap__step-icon",
    );

    expect(icon?.getAttribute("src")).toBe(
      "https://example.com/wedding-hall.png",
    );
    expect(
      screen
        .getByRole("button", {
          name: /02.*예식 형태·식순·입장 방식 결정/,
        })
        .querySelector(".preparation-roadmap__step-icon"),
    ).toBeNull();

    fireEvent.error(icon!);

    expect(icon?.hidden).toBe(true);
  });

  it("모바일 최초 진입 시 초기 선택 상태를 표시하고 상세는 자동 확장하지 않는다", async () => {
    setViewportMatches();
    await renderFeature();

    expect(screen.getByRole("heading", { name: "준비 로드맵" })).toBeTruthy();
    expect(
      screen.queryByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toBeNull();
    const selectedStep = screen.getByRole("button", {
      name: /01.*웨딩홀 투어와 계약/,
      pressed: true,
    });

    expect(selectedStep.getAttribute("aria-haspopup")).toBe("dialog");
    expect(selectedStep.hasAttribute("aria-controls")).toBe(false);
  });

  it("모바일 바텀시트에서 웹과 같은 상세 목록을 바로 표시한다", async () => {
    setViewportMatches();
    await renderFeature();

    fireEvent.click(
      screen.getByRole("button", {
        name: /01.*웨딩홀 투어와 계약/,
      }),
    );

    const detail = screen.getByRole("dialog", {
      name: "웨딩홀 투어와 계약",
    });
    expect(
      within(detail).getByRole("heading", { name: "웨딩홀 투어와 계약" }),
    ).toBeTruthy();
    expect(within(detail).queryByText("웨딩홀")).toBeNull();
    expect(
      within(detail).getByText("웨딩홀을 둘러보고 계약해요."),
    ).toBeTruthy();
    expect(
      within(detail).getByRole("heading", {
        name: "이 단계의 체크리스트",
      }),
    ).toBeTruthy();
    expect(
      within(detail).getByRole("heading", {
        name: "추가할 수 있는 할 일",
      }),
    ).toBeTruthy();
    expect(within(detail).getByText("웨딩홀 투어")).toBeTruthy();
    expect(
      within(detail)
        .getByRole("button", {
          name: "웨딩홀 견적 비교 추가",
        })
        .hasAttribute("disabled"),
    ).toBe(false);
    expect(
      within(detail)
        .getByRole("button", {
          name: "남은 할 일 모두 추가",
        })
        .hasAttribute("disabled"),
    ).toBe(false);
    expect(
      within(detail).queryByRole("button", { name: /내 체크리스트/ }),
    ).toBeNull();
  });

  it("모바일 바텀시트에서도 빈 체크리스트를 안내한다", async () => {
    setViewportMatches();
    await renderFeature();

    fireEvent.click(
      screen.getByRole("button", {
        name: /02.*예식 형태·식순·입장 방식 결정/,
      }),
    );
    expect(screen.getByText("이 단계에 추가한 할 일이 없어요.")).toBeTruthy();
  });

  it("모바일에서는 선택한 단계의 바텀시트를 열고 포커스를 이동한다", async () => {
    setViewportMatches();
    await renderFeature();

    const firstStepButton = screen.getByRole("button", {
      name: /01.*웨딩홀 투어와 계약/,
    });
    firstStepButton.focus();
    fireEvent.click(firstStepButton);

    const firstDetail = screen.getByRole("dialog", {
      name: "웨딩홀 투어와 계약",
    });
    const dragHandle = within(firstDetail).getByRole("button", {
      name: "아래로 밀어 단계 상세 닫기",
    });
    const scrollContainer = document.querySelector<HTMLElement>(
      "[data-page-scroll-container]",
    );

    expect(firstDetail).toBeTruthy();
    expect(document.activeElement).toBe(dragHandle);
    expect(
      within(firstDetail).queryByRole("button", {
        name: "단계 상세 닫기",
      }),
    ).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    expect(scrollContainer?.style.overflow).toBe("hidden");
    expect(firstStepButton).toBeTruthy();

    fireEvent.keyDown(firstDetail, { key: "Escape" });

    expect(firstDetail.parentElement?.className).toContain(
      "bottom-sheet-dismiss--closing",
    );
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.transitionEnd(firstDetail, { propertyName: "transform" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(firstStepButton);
    expect(document.body.style.overflow).toBe("");
    expect(scrollContainer?.style.overflow).toBe("");
  });

  it("모바일 바텀시트를 스크림과 드래그 핸들로 닫는다", async () => {
    setViewportMatches();
    await renderFeature();
    const stepButton = screen.getByRole("button", {
      name: /01.*웨딩홀 투어와 계약/,
    });

    fireEvent.click(stepButton);
    fireEvent.click(
      screen.getAllByRole("button", { name: "단계 상세 닫기" })[0],
    );
    const firstDetail = screen.getByRole("dialog");
    expect(firstDetail.parentElement?.className).toContain(
      "bottom-sheet-dismiss--closing",
    );
    fireEvent.transitionEnd(firstDetail, { propertyName: "transform" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(stepButton);
    const secondDetail = screen.getByRole("dialog");
    const dragHandle = within(secondDetail).getByRole("button", {
      name: "아래로 밀어 단계 상세 닫기",
    });
    fireEvent.pointerDown(dragHandle, {
      button: 0,
      clientY: 20,
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent.pointerMove(dragHandle, {
      clientY: 140,
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent.pointerUp(dragHandle, {
      clientY: 140,
      pointerId: 1,
      pointerType: "touch",
    });
    expect(secondDetail.parentElement?.className).toContain(
      "bottom-sheet-dismiss--closing",
    );
    fireEvent.transitionEnd(secondDetail, { propertyName: "transform" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("모바일에서 현재 초기 단계 카드를 선택해도 선택 이벤트를 전송한다", async () => {
    setViewportMatches();
    await renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.click(
      screen.getByRole("button", {
        name: /01.*웨딩홀 투어와 계약/,
      }),
    );

    expect(analyticsMocks.track).toHaveBeenCalledOnce();
    expect(analyticsMocks.track).toHaveBeenCalledWith({
      name: "preparation_step_select",
      parameters: {
        category_id: "wedding-hall",
        step_id: "step-1",
        step_order: 1,
      },
    });
  });

  it("모바일에서 카테고리를 변경하면 상세 선택을 초기화한다", async () => {
    setViewportMatches();
    await renderFeature();
    fireEvent.click(
      screen.getByRole("button", {
        name: /01.*웨딩홀 투어와 계약/,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "스드메" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: /01.*스드메 상담·견적과 패키지 계약/,
      }),
    ).toBeTruthy();
  });

  it("모바일에서 다른 카테고리를 선택하면 페이지 스크롤을 맨 위로 초기화한다", async () => {
    setViewportMatches();
    await renderFeature();
    const scrollContainer = document.querySelector<HTMLElement>(
      "[data-page-scroll-container]",
    );

    expect(scrollContainer).not.toBeNull();
    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTop = 400;
    fireEvent.click(screen.getByRole("button", { name: "웨딩홀" }));

    expect(scrollContainer.scrollTop).toBe(400);

    fireEvent.click(screen.getByRole("button", { name: "스드메" }));

    expect(scrollContainer.scrollTop).toBe(0);
  });

  it("태블릿과 데스크톱에서 카테고리를 변경해도 페이지 스크롤을 유지한다", async () => {
    setViewportMatches(false);
    await renderFeature();
    const scrollContainer = document.querySelector<HTMLElement>(
      "[data-page-scroll-container]",
    );

    expect(scrollContainer).not.toBeNull();
    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTop = 400;
    fireEvent.click(screen.getByRole("button", { name: "스드메" }));

    expect(scrollContainer.scrollTop).toBe(400);
  });

  it("viewport 변경 후에도 선택 상태를 유지하고 이벤트를 전송하지 않는다", async () => {
    const viewport = setViewportMatches();
    await renderFeature();
    fireEvent.click(
      screen.getByRole("button", {
        name: /02.*예식 형태·식순·입장 방식 결정/,
      }),
    );
    analyticsMocks.track.mockClear();

    act(() => {
      viewport.change(false);
    });

    expect(
      screen
        .getByRole("button", {
          name: /02.*예식 형태·식순·입장 방식 결정/,
        })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(analyticsMocks.track).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toHaveLength(1);
  });

  it("데스크톱에서 단계를 변경한 뒤 모바일로 전환하면 자동 확장하지 않는다", async () => {
    const viewport = setViewportMatches();
    await renderFeature();
    fireEvent.click(
      screen.getByRole("button", {
        name: /02.*예식 형태·식순·입장 방식 결정/,
      }),
    );

    act(() => {
      viewport.change(false);
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: /03.*예식 진행자와 당일 도우미 섭외/,
      }),
    );
    act(() => {
      viewport.change({ compact: true, mobile: true });
    });

    expect(
      screen.queryByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: /03.*예식 진행자와 당일 도우미 섭외/,
      }),
    ).toBeTruthy();
  });

  it("태블릿에서도 초기 단계 상세 패널과 선택 상태를 표시한다", async () => {
    setViewportMatches({ compact: true, mobile: false });
    await renderFeature();

    expect(
      screen.getByRole("button", {
        name: /01.*웨딩홀 투어와 계약/,
        pressed: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toHaveLength(1);
  });

  it("모바일에서는 세로 스크롤로 카테고리를 변경하지 않는다", async () => {
    setViewportMatches();
    await renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.wheel(getRoadmapTitle(), {
      deltaX: 0,
      deltaY: 100,
    });

    expect(analyticsMocks.track).not.toHaveBeenCalled();
    expect(getRoadmapTitle()).toBeTruthy();
  });
});
