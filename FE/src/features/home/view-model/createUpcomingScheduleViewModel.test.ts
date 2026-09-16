import { describe, expect, it } from "vitest";

import { createUpcomingScheduleViewModel } from "./createUpcomingScheduleViewModel";

describe("createUpcomingScheduleViewModel", () => {
  it("API 순서를 유지하며 상대 날짜와 일정 표현을 만든다", () => {
    const viewModel = createUpcomingScheduleViewModel({
      referenceDate: "2026-09-16",
      schedules: [
        {
          date: "2026-09-20",
          id: 2,
          place: "  ",
          startTime: null,
          title: "두 번째 응답",
        },
        {
          date: "2026-09-16",
          id: 1,
          place: "비비디 웨딩홀",
          startTime: "2026-09-16T14:05:00",
          title: "첫 번째 날짜",
        },
      ],
    });

    expect(viewModel).not.toHaveProperty("countLabel");
    expect(viewModel.items.map((item) => item.id)).toEqual(["2", "1"]);
    expect(viewModel.items[0]).toMatchObject({
      detailLabel: "시간 미정 · 장소 없음",
      relativeDateLabel: "4일 뒤",
      statusLabel: "예정",
    });
    expect(viewModel.items[1]).toMatchObject({
      dateLabel: "9월 16일",
      detailLabel: "오후 2:05 · 비비디 웨딩홀",
      relativeDateLabel: "오늘",
    });
  });
});
