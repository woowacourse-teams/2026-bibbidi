import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../../shared/responsive";
import { installMatchMedia } from "../../../test/matchMedia";
import { createHomeScheduleDashboardViewModel } from "../view-model/createHomeScheduleDashboardViewModel";
import {
  GuestHomeScheduleDashboard,
  HomeScheduleDashboard,
} from "./HomeScheduleDashboard";

function getSectionHeadings() {
  const dashboard = screen.getByRole("region", { name: "홈 일정 대시보드" });

  return within(dashboard)
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HomeScheduleDashboard", () => {
  it("모바일에서는 캘린더, 추천 할 일, 일정이 필요한 할 일 순서로 표시한다", () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);

    render(<GuestHomeScheduleDashboard referenceDate="2026-09-30" />);

    expect(getSectionHeadings()).toEqual([
      "캘린더",
      "추천 할 일",
      "일정이 필요한 할 일",
    ]);
  });

  it("데스크톱에서는 기존 섹션 순서를 유지하고 너비 변경에 맞춰 실제 순서를 바꾼다", () => {
    const matchMedia = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    const viewModel = createHomeScheduleDashboardViewModel({
      recommended: { status: "empty" },
      unscheduled: { status: "empty" },
    });

    render(
      <MemoryRouter>
        <HomeScheduleDashboard
          onAddRecommendedTask={vi.fn()}
          onRetryRecommended={vi.fn()}
          onRetryUnscheduled={vi.fn()}
          referenceDate="2026-09-30"
          schedules={[]}
          viewModel={viewModel}
        />
      </MemoryRouter>,
    );

    expect(getSectionHeadings()).toEqual([
      "캘린더",
      "일정이 필요한 할 일",
      "추천 할 일",
    ]);

    act(() => matchMedia.setMatches(true));

    expect(getSectionHeadings()).toEqual([
      "캘린더",
      "추천 할 일",
      "일정이 필요한 할 일",
    ]);
  });
});
