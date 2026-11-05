import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
  it("비로그인 소개를 PC에서는 캘린더 뒤에, 모바일에서는 앞에 표시하며 선택한 달을 유지한다", () => {
    const matchMedia = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);

    render(
      <MemoryRouter>
        <GuestHomeScheduleDashboard
          recommended={
            <section>
              <h2>추천 할 일</h2>
            </section>
          }
          referenceDate="2026-09-30"
        />
      </MemoryRouter>,
    );

    const introductionTitle = "일정이 필요한 할 일";
    const starterTitle = "추천 할 일";
    expect(getSectionHeadings()).toEqual([
      "캘린더",
      introductionTitle,
      starterTitle,
    ]);

    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    act(() => matchMedia.setMatches(true));

    expect(getSectionHeadings()).toEqual([
      introductionTitle,
      "캘린더",
      starterTitle,
    ]);
    expect(
      screen.getByRole("table", { name: "2026년 10월 달력" }),
    ).toBeTruthy();

    act(() => matchMedia.setMatches(false));

    expect(getSectionHeadings()).toEqual([
      "캘린더",
      introductionTitle,
      starterTitle,
    ]);
    expect(
      screen.getByRole("table", { name: "2026년 10월 달력" }),
    ).toBeTruthy();
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
