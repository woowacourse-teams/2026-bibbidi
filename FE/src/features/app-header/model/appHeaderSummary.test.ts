import { describe, expect, it } from "vitest";

import type {
  ChecklistItemStatus,
  ChecklistQueryItemModel,
} from "../../checklist";
import { createAppHeaderSummaryModel } from "./appHeaderSummary";

describe("AppHeaderSummaryModel", () => {
  it("체크리스트의 완료 항목 수와 전체 항목 수를 계산한다", () => {
    expect(
      createAppHeaderSummaryModel({
        categories: [
          {
            id: "2",
            title: "웨딩홀",
            items: ["done", "continue", "prev", "done"].map(
              (status, index) =>
                ({
                  appointments: [],
                  categoryId: "2",
                  checklistItemId: index,
                  id: String(index),
                  sourceCatalogItemId: index === 3 ? null : index,
                  status: status as ChecklistItemStatus,
                  title: "할 일",
                }) satisfies ChecklistQueryItemModel,
            ),
          },
          { id: "1", title: "빈 카테고리", items: [] },
        ],
      }),
    ).toEqual({
      categories: [
        { id: "2", title: "웨딩홀", completedTaskCount: 2, totalTaskCount: 4 },
        {
          id: "1",
          title: "빈 카테고리",
          completedTaskCount: 0,
          totalTaskCount: 0,
        },
      ],
      completedTaskCount: 2,
      totalTaskCount: 4,
    });
  });
});
