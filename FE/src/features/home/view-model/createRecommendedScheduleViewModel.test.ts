import { describe, expect, it } from "vitest";

import { createRecommendedScheduleViewModel } from "./createRecommendedScheduleViewModel";

const model = {
  items: [
    {
      category: "웨딩홀",
      catalogItemId: 101,
      stepName: "웨딩홀 정하기",
      title: "웨딩홀 투어",
    },
    {
      category: "스드메",
      catalogItemId: 102,
      stepName: "스드메 업체 확정",
      title: "드레스샵 확정",
    },
    {
      category: "예식",
      catalogItemId: 103,
      stepName: "예식 준비",
      title: "식순 정하기",
    },
  ],
};

describe("createRecommendedScheduleViewModel", () => {
  it("항목별 추가 상태를 버튼 표현과 안전한 오류 문구로 변환한다", () => {
    const viewModel = createRecommendedScheduleViewModel(model, {
      addedCatalogItemIds: [102],
      addingCatalogItemIds: [101],
      additionErrors: { 103: "할 일을 추가하지 못했어요. 다시 시도해 주세요." },
    });

    expect(viewModel.items).toEqual([
      expect.objectContaining({
        addActionLabel: "추가 중...",
        additionErrorMessage: undefined,
        catalogItemId: 101,
        isAddActionDisabled: true,
      }),
      expect.objectContaining({
        addActionLabel: "추가됨",
        additionErrorMessage: undefined,
        catalogItemId: 102,
        isAddActionDisabled: true,
      }),
      expect.objectContaining({
        addActionLabel: "다시 시도",
        additionErrorMessage: "할 일을 추가하지 못했어요. 다시 시도해 주세요.",
        catalogItemId: 103,
        isAddActionDisabled: false,
      }),
    ]);
  });

  it("처리 상태가 없는 항목은 추가 가능한 기본 동작을 제공한다", () => {
    const viewModel = createRecommendedScheduleViewModel(model, {
      addedCatalogItemIds: [],
      addingCatalogItemIds: [],
      additionErrors: {},
    });

    expect(
      viewModel.items.every(
        (item) =>
          item.addActionLabel === "내 할 일에 추가" &&
          !item.isAddActionDisabled,
      ),
    ).toBe(true);
  });
});
