import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
