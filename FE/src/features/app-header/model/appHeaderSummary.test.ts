import { describe, expect, it } from "vitest";

import type {
  ChecklistItemStatus,
  ChecklistQueryItemModel,
} from "../../checklist";
import {
  createAppHeaderSummaryModel,
  summarizePersonalChecklist,
} from "./appHeaderSummary";

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
  it("snapshot보다 새로 등록된 원본 항목과 카테고리도 완료율에 포함한다", () => {
    const item = {
      id: 1,
      title: "새 할 일",
      createdAt: null,
      sourceCatalogItemId: 500,
      status: "done",
    } as const;
    expect(
      summarizePersonalChecklist(
        [{ id: "2", label: "웨딩홀" }],
        [
          { ...item, appointments: [], categoryId: 2 },
          { ...item, appointments: [], categoryId: 10, id: 2, status: "prev" },
        ],
      ),
    ).toEqual({
      categories: [
        { id: "2", title: "웨딩홀", completedTaskCount: 1, totalTaskCount: 1 },
        {
          id: "10",
          title: "기타 준비",
          completedTaskCount: 0,
          totalTaskCount: 1,
        },
      ],
      completedTaskCount: 1,
      totalTaskCount: 2,
    });
  });
});
