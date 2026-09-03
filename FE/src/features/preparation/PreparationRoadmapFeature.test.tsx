import { StrictMode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const analyticsMocks = vi.hoisted(() => ({
  track: vi.fn(),
}));
const apiMocks = vi.hoisted(() => ({
  getPublicPreparationCatalog: vi.fn(),
}));

vi.mock("../../infrastructure/analytics", () => ({
  analytics: {
    initialize: vi.fn(),
    track: analyticsMocks.track,
  },
}));
vi.mock("./api/getPublicPreparationCatalog", () => ({
  getPublicPreparationCatalog: apiMocks.getPublicPreparationCatalog,
}));

import { PreparationRoadmapFeature } from "./PreparationRoadmapFeature";
import { preparationCatalogFixture } from "./test/fixtures/preparationCatalog.fixture";

async function renderFeature({ strictMode = false } = {}) {
  const feature = <PreparationRoadmapFeature />;

  const result = render(
    strictMode ? <StrictMode>{feature}</StrictMode> : feature,
  );
  await screen.findByRole("heading", { name: "준비 로드맵" });

  return result;
}

function getRoadmapTitle() {
  return screen.getByRole("heading", { name: "준비 로드맵" });
}

const COMPACT_LAYOUT_MEDIA_QUERY = "(max-width: 1439px)";
const MOBILE_LAYOUT_MEDIA_QUERY = "(max-width: 760px)";

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
    analyticsMocks.track.mockReset();
    apiMocks.getPublicPreparationCatalog.mockResolvedValue(
      preparationCatalogFixture,
    );
  });

  it("StrictMode에서도 준비 목록 최초 진입 이벤트를 한 번 전송한다", async () => {
    await renderFeature({ strictMode: true });

    expect(analyticsMocks.track).toHaveBeenCalledOnce();
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
    analyticsMocks.track.mockReset();
    apiMocks.getPublicPreparationCatalog.mockReset();
  });

  it("응답을 기다리는 동안 로딩 상태를 표시한다", () => {
    apiMocks.getPublicPreparationCatalog.mockReturnValue(new Promise(() => {}));

    render(<PreparationRoadmapFeature />);

    expect(screen.getByRole("status").textContent).toBe(
      "준비 목록을 불러오고 있어요.",
    );
  });

  it("화면에서 제거되면 진행 중인 요청을 취소한다", () => {
    let requestSignal: AbortSignal | undefined;
    apiMocks.getPublicPreparationCatalog.mockImplementation(
      (signal?: AbortSignal) => {
        requestSignal = signal;
        return new Promise(() => {});
      },
    );

    const { unmount } = render(<PreparationRoadmapFeature />);
    expect(requestSignal?.aborted).toBe(false);

    unmount();

    expect(requestSignal?.aborted).toBe(true);
  });

  it("준비 단계가 없으면 빈 상태를 표시한다", async () => {
    apiMocks.getPublicPreparationCatalog.mockResolvedValue({
      categories: [{ id: "empty", label: "비어 있음" }],
      roadmaps: [{ categoryId: "empty", steps: [] }],
      stepDetails: [],
    });

    render(<PreparationRoadmapFeature />);

    expect(await screen.findByText("표시할 준비 목록이 없어요.")).toBeTruthy();
    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("조회 실패를 안내하고 다시 시도할 수 있다", async () => {
    apiMocks.getPublicPreparationCatalog
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce(preparationCatalogFixture);

    render(<PreparationRoadmapFeature />);

    expect(
      await screen.findByText("준비 목록을 불러오지 못했어요."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(
      await screen.findByRole("heading", { name: "준비 로드맵" }),
    ).toBeTruthy();
    expect(apiMocks.getPublicPreparationCatalog).toHaveBeenCalledTimes(2);
  });
});

describe("PreparationRoadmapFeature 반응형 상세 패널", () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    analyticsMocks.track.mockReset();
    apiMocks.getPublicPreparationCatalog.mockResolvedValue(
      preparationCatalogFixture,
    );
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
      screen.getByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: /01.*웨딩홀 투어와 계약/,
        pressed: true,
      }),
    ).toBeTruthy();
  });

  it("단계 카드에는 중복되는 상세 설명을 표시하지 않는다", async () => {
    setViewportMatches(false);
    await renderFeature();

    const firstStepButton = screen.getByRole("button", {
      name: "01.웨딩홀 투어와 계약",
    });

    expect(
      firstStepButton.querySelector(".preparation-roadmap__step-description"),
    ).toBeNull();
    expect(
      firstStepButton.querySelector(".preparation-roadmap__step-title")
        ?.textContent,
    ).toBe("웨딩홀 투어와 계약");
  });

  it("모바일 최초 진입 시 초기 선택 상태를 표시하고 상세는 자동 확장하지 않는다", async () => {
    setViewportMatches();
    await renderFeature();

    expect(
      screen.queryByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: /01.*웨딩홀 투어와 계약/,
        pressed: true,
      }),
    ).toBeTruthy();
  });

  it("모바일에서는 선택한 단계 카드를 상세 패널로 교체한다", async () => {
    setViewportMatches();
    await renderFeature();

    const firstStepButton = screen.getByRole("button", {
      name: /01.*웨딩홀 투어와 계약/,
    });
    const firstStep = screen
      .getByRole("button", { name: /01.*웨딩홀 투어와 계약/ })
      .closest("li");

    expect(firstStep).not.toBeNull();
    fireEvent.click(firstStepButton);

    expect(
      within(firstStep!).queryByRole("button", {
        name: /01.*웨딩홀 투어와 계약/,
      }),
    ).toBeNull();
    const firstDetail = within(firstStep!).getByRole("complementary", {
      name: "이 단계에서 준비할 일",
    });

    expect(firstDetail).toBeTruthy();
    expect(document.activeElement).toBe(firstDetail);
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith({
      behavior: "smooth",
      block: "start",
    });

    const secondStepButton = screen.getByRole("button", {
      name: /02.*예식 형태·식순·입장 방식 결정/,
    });
    const secondStep = secondStepButton.closest("li");

    expect(secondStep).not.toBeNull();
    fireEvent.click(secondStepButton);

    expect(
      within(firstStep!).getByRole("button", {
        name: /01.*웨딩홀 투어와 계약/,
      }),
    ).toBeTruthy();
    expect(
      within(firstStep!).queryByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toBeNull();
    const secondDetail = within(secondStep!).getByRole("complementary", {
      name: "이 단계에서 준비할 일",
    });

    expect(secondDetail).toBeTruthy();
    expect(document.activeElement).toBe(secondDetail);
    expect(
      screen.getAllByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toHaveLength(1);
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(2);
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

    expect(
      screen.queryByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: /01.*스드메 상담·견적과 패키지 계약/,
      }),
    ).toBeTruthy();
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
