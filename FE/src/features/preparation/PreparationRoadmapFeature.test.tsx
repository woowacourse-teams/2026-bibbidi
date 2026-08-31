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

function getRoadmapTitle(name: string) {
  return screen.getByRole("heading", { name });
}

function setViewportMatches(initialMatches = true) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let matches = initialMatches;

  const matchMedia = vi
    .fn()
    .mockImplementation((media: string): MediaQueryList => ({
      addEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      },
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches,
      media,
      onchange: null,
      removeEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      },
      removeListener: vi.fn(),
    }));

  vi.stubGlobal("matchMedia", matchMedia);

  return {
    change(matchesNext: boolean) {
      matches = matchesNext;
      listeners.forEach((listener) =>
        listener({ matches: matchesNext } as MediaQueryListEvent),
      );
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
    const roadmapTitle = getRoadmapTitle("웨딩홀 준비 로드맵");

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

    fireEvent.wheel(getRoadmapTitle("웨딩홀 준비 로드맵"), {
      deltaX: 0,
      deltaY: -100,
    });

    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("마지막 카테고리에서 다음 방향으로 스크롤하면 이벤트를 전송하지 않는다", () => {
    renderFeature();
    fireEvent.click(screen.getByRole("button", { name: "기타" }));
    analyticsMocks.track.mockClear();

    fireEvent.wheel(getRoadmapTitle("기타 준비 로드맵"), {
      deltaX: 0,
      deltaY: 100,
    });

    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });
});

describe("PreparationRoadmapFeature 반응형 상세 패널", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("모바일에서는 선택한 단계 카드 바로 아래에 상세 패널을 표시한다", () => {
    setViewportMatches();
    renderFeature();

    const firstStep = screen
      .getByRole("button", { name: /01.*예정.*웨딩홀 투어와 계약/ })
      .closest("li");

    expect(firstStep).not.toBeNull();
    expect(
      within(firstStep!).getByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toBeTruthy();

    const secondStepButton = screen.getByRole("button", {
      name: /02.*예정.*예식 형태·식순·입장 방식 결정/,
    });
    fireEvent.click(secondStepButton);

    expect(
      within(firstStep!).queryByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toBeNull();
    expect(
      within(secondStepButton.closest("li")!).getByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("complementary", {
        name: "이 단계에서 준비할 일",
      }),
    ).toHaveLength(1);
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

  it("모바일에서는 세로 스크롤로 카테고리를 변경하지 않는다", () => {
    setViewportMatches();
    renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.wheel(getRoadmapTitle("웨딩홀 준비 로드맵"), {
      deltaX: 0,
      deltaY: 100,
    });

    expect(analyticsMocks.track).not.toHaveBeenCalled();
    expect(getRoadmapTitle("웨딩홀 준비 로드맵")).toBeTruthy();
  });

  it("viewport 복귀 후 첫 wheel 제스처로 카테고리를 변경한다", () => {
    const viewport = setViewportMatches(false);
    renderFeature();
    analyticsMocks.track.mockClear();

    fireEvent.wheel(getRoadmapTitle("웨딩홀 준비 로드맵"), {
      deltaX: 0,
      deltaY: 100,
    });
    expect(getRoadmapTitle("스드메 준비 로드맵")).toBeTruthy();

    act(() => {
      viewport.change(true);
    });
    act(() => {
      viewport.change(false);
    });
    analyticsMocks.track.mockClear();

    fireEvent.wheel(getRoadmapTitle("스드메 준비 로드맵"), {
      deltaX: 0,
      deltaY: 100,
    });

    expect(getRoadmapTitle("초대 준비 로드맵")).toBeTruthy();
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
  });
});
