import { describe, expect, it } from "vitest";

import { createAppHeaderSummaryViewModel } from "./createAppHeaderSummaryViewModel";

const progress = { completedTaskCount: 2, totalTaskCount: 4 };
const today = new Date(2027, 4, 15, 23, 59);

describe("createAppHeaderSummaryViewModel", () => {
  it.each([
    ["2027-05-16", "D-1"],
    ["2027-05-15", "D-Day"],
    ["2027-05-14", "D+1"],
  ])("결혼 예정일 %s의 D-Day를 %s로 표시한다", (date, label) => {
    const viewModel = createAppHeaderSummaryViewModel(
      progress,
      { status: "loaded", date },
      today,
    );
    expect(viewModel.dDayLabel).toBe(label);
    expect(viewModel.weddingDateLabel).toContain("2027년 5월");
    expect(viewModel.progress?.label).toBe("50%");
  });

  it("미설정, 조회 중, 조회 실패를 구분하고 완료율과 독립적으로 유지한다", () => {
    expect(
      createAppHeaderSummaryViewModel(
        progress,
        { status: "loaded", date: null },
        today,
      ).mobileDDayLabel,
    ).toBe("D-Day 미설정");
    expect(
      createAppHeaderSummaryViewModel(progress, { status: "loading" }, today)
        .mobileDDayLabel,
    ).toBe("결혼 예정일 조회 중");
    const failed = createAppHeaderSummaryViewModel(
      progress,
      { status: "error" },
      today,
    );
    expect(failed.mobileDDayLabel).toBe("결혼 예정일 조회 실패");
    expect(failed.progress?.label).toBe("50%");
    expect(
      createAppHeaderSummaryViewModel(
        null,
        { status: "loaded", date: "2027-05-15" },
        today,
      ).progress,
    ).toBeNull();
  });
});
