import { StrictMode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const analyticsMocks = vi.hoisted(() => ({
  track: vi.fn(),
}));

vi.mock("../../infrastructure/analytics", () => ({
  analytics: {
    initialize: vi.fn(),
    track: analyticsMocks.track,
  },
}));

import { PreparationRoadmapFeature } from "./PreparationRoadmapFeature";

function renderFeature({ strictMode = false } = {}) {
  const feature = <PreparationRoadmapFeature />;

  return render(strictMode ? <StrictMode>{feature}</StrictMode> : feature);
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
  });

  it("StrictMode에서도 준비 목록 최초 진입 이벤트를 한 번 전송한다", () => {
    renderFeature({ strictMode: true });

    expect(analyticsMocks.track).toHaveBeenCalledOnce();
    expect(analyticsMocks.track).toHaveBeenCalledWith({
      name: "preparation_catalog_view",
      parameters: {
        initial_category_id: "wedding-hall",
      },
    });
  });

  it("카테고리 버튼 선택 이벤트를 전송한다", () => {
    renderFeature();
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

  it("현재 카테고리와 단계를 다시 선택하면 이벤트를 전송하지 않는다", () => {
    renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "웨딩홀" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /01.*예정.*웨딩홀 투어와 계약/,
      }),
    );

    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("로드맵 단계 선택 이벤트를 전송한다", () => {
    renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.click(
      screen.getByRole("button", {
        name: /02.*예정.*예식 형태·식순·입장 방식 결정/,
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

  it("스크롤로 다음 카테고리를 선택하고 한 제스처에서는 한 번만 전송한다", () => {
    renderFeature();
    analyticsMocks.track.mockClear();
    const roadmapTitle = getRoadmapTitle();

    fireEvent.wheel(roadmapTitle, { deltaX: 0, deltaY: 100 });
    fireEvent.wheel(roadmapTitle, { deltaX: 0, deltaY: 100 });

    expect(analyticsMocks.track).toHaveBeenCalledOnce();
    expect(analyticsMocks.track).toHaveBeenCalledWith({
      name: "preparation_category_select",
      parameters: {
        category_id: "studio-dress-makeup",
        direction: "next",
        input_method: "wheel",
        previous_category_id: "wedding-hall",
      },
    });
  });

  it("첫 카테고리에서 이전 방향으로 스크롤하면 이벤트를 전송하지 않는다", () => {
    renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.wheel(getRoadmapTitle(), {
      deltaX: 0,
      deltaY: -100,
    });

    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("마지막 카테고리에서 다음 방향으로 스크롤하면 이벤트를 전송하지 않는다", () => {
    renderFeature();
    fireEvent.click(screen.getByRole("button", { name: "기타" }));
    analyticsMocks.track.mockClear();

    fireEvent.wheel(getRoadmapTitle(), {
      deltaX: 0,
      deltaY: 100,
    });

    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });
});

describe("PreparationRoadmapFeature 반응형 상세 패널", () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
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

  it("로드맵 상세 패널에서는 중복되는 카테고리 라벨을 표시하지 않는다", () => {
    setViewportMatches(false);
    renderFeature();

    const detail = screen.getByRole("complementary", {
      name: "이 단계에서 준비할 일",
    });

    expect(within(detail).queryByText("웨딩홀")).toBeNull();
  });

  it("모바일 최초 진입 시에는 단계를 자동 선택하지 않는다", () => {
    setViewportMatches();
    renderFeature();

    expect(
      screen.queryByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: /01.*예정.*웨딩홀 투어와 계약/,
      }),
    ).toBeTruthy();
  });

  it("모바일에서는 선택한 단계 카드를 상세 패널로 교체한다", () => {
    setViewportMatches();
    renderFeature();

    const firstStepButton = screen.getByRole("button", {
      name: /01.*예정.*웨딩홀 투어와 계약/,
    });
    const firstStep = screen
      .getByRole("button", { name: /01.*예정.*웨딩홀 투어와 계약/ })
      .closest("li");

    expect(firstStep).not.toBeNull();
    fireEvent.click(firstStepButton);

    expect(
      within(firstStep!).queryByRole("button", {
        name: /01.*예정.*웨딩홀 투어와 계약/,
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
      name: /02.*예정.*예식 형태·식순·입장 방식 결정/,
    });
    const secondStep = secondStepButton.closest("li");

    expect(secondStep).not.toBeNull();
    fireEvent.click(secondStepButton);

    expect(
      within(firstStep!).getByRole("button", {
        name: /01.*예정.*웨딩홀 투어와 계약/,
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

  it("모바일에서 현재 초기 단계 카드를 선택해도 선택 이벤트를 전송한다", () => {
    setViewportMatches();
    renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.click(
      screen.getByRole("button", {
        name: /01.*예정.*웨딩홀 투어와 계약/,
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

  it("모바일에서 카테고리를 변경하면 상세 선택을 초기화한다", () => {
    setViewportMatches();
    renderFeature();
    fireEvent.click(
      screen.getByRole("button", {
        name: /01.*예정.*웨딩홀 투어와 계약/,
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
        name: /01.*예정.*스드메 상담·견적과 패키지 계약/,
      }),
    ).toBeTruthy();
  });

  it("viewport 변경 후에도 선택 상태를 유지하고 이벤트를 전송하지 않는다", () => {
    const viewport = setViewportMatches();
    renderFeature();
    fireEvent.click(
      screen.getByRole("button", {
        name: /02.*예정.*예식 형태·식순·입장 방식 결정/,
      }),
    );
    analyticsMocks.track.mockClear();

    act(() => {
      viewport.change(false);
    });

    expect(
      screen
        .getByRole("button", {
          name: /02.*예정.*예식 형태·식순·입장 방식 결정/,
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

  it("데스크톱에서 단계를 변경한 뒤 모바일로 전환하면 자동 확장하지 않는다", () => {
    const viewport = setViewportMatches();
    renderFeature();
    fireEvent.click(
      screen.getByRole("button", {
        name: /02.*예정.*예식 형태·식순·입장 방식 결정/,
      }),
    );

    act(() => {
      viewport.change(false);
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: /03.*예정.*예식 진행자와 당일 도우미 섭외/,
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
        name: /03.*예정.*예식 진행자와 당일 도우미 섭외/,
      }),
    ).toBeTruthy();
  });

  it("태블릿에서는 기존 하단 상세 패널과 선택 상태를 유지한다", () => {
    setViewportMatches({ compact: true, mobile: false });
    renderFeature();

    expect(
      screen.getByRole("button", {
        name: /01.*예정.*웨딩홀 투어와 계약/,
        pressed: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toHaveLength(1);
  });

  it("모바일에서는 세로 스크롤로 카테고리를 변경하지 않는다", () => {
    setViewportMatches();
    renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.wheel(getRoadmapTitle(), {
      deltaX: 0,
      deltaY: 100,
    });

    expect(analyticsMocks.track).not.toHaveBeenCalled();
    expect(getRoadmapTitle()).toBeTruthy();
  });

  it("viewport 복귀 후 첫 wheel 제스처로 카테고리를 변경한다", () => {
    const viewport = setViewportMatches(false);
    renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.wheel(getRoadmapTitle(), {
      deltaX: 0,
      deltaY: 100,
    });
    expect(
      screen
        .getByRole("button", { name: "스드메" })
        .getAttribute("aria-pressed"),
    ).toBe("true");

    act(() => {
      viewport.change(true);
    });
    act(() => {
      viewport.change(false);
    });
    analyticsMocks.track.mockClear();

    fireEvent.wheel(getRoadmapTitle(), {
      deltaX: 0,
      deltaY: 100,
    });

    expect(
      screen.getByRole("button", { name: "초대" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
  });
});
