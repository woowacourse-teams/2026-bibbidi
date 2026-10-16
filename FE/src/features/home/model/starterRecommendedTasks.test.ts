import { describe, expect, it } from "vitest";

import type { CatalogModel } from "../../catalog";
import { createStarterRecommendedItems } from "./starterRecommendedTasks";

describe("createStarterRecommendedItems", () => {
  it("실제 카테고리·단계·유효한 카탈로그 ID가 있는 항목만 담을 후보로 변환한다", () => {
    const catalog: CatalogModel = {
      categories: [{ id: "hall", label: "웨딩홀" }],
      roadmaps: [
        {
          categoryId: "hall",
          steps: [
            { id: "tour", title: "웨딩홀 정하기", order: 1 },
            { id: "missing", title: "계약", order: 2 },
          ],
        },
        {
          categoryId: "unknown",
          steps: [{ id: "tour", title: "알 수 없음", order: 1 }],
        },
      ],
      stepDetails: [
        {
          stepId: "tour",
          description: "투어",
          tasks: [
            { id: "101", title: "웨딩홀 투어" },
            { id: "0", title: "잘못된 ID" },
            { id: "invalid", title: "잘못된 ID" },
          ],
        },
      ],
    };
    expect(createStarterRecommendedItems(catalog)).toEqual([
      {
        catalogItemId: 101,
        title: "웨딩홀 투어",
        category: "웨딩홀",
        phase: 1,
        stepName: "웨딩홀 정하기",
      },
    ]);
  });
});
