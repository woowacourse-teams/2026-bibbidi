import { describe, expect, it } from "vitest";
import {
  ChecklistQueryItemModel,
  ChecklistQueryModel,
} from "../../checklist/model/checklistQuery";
import { createPersonalRoadmapViewModel } from "./createPersonalRoadmapViewModel";

function item(
  id: number,
  status: ChecklistQueryItemModel["status"],
): ChecklistQueryItemModel {
  return {
    id: String(id),
    title: `할 일 ${id}`,
    categoryId: "wedding-hall",
    checklistItemId: id,
    sourceCatalogItemId: id,
    status,
    appointments: [],
  };
}

function checklist(
  statuses: ChecklistQueryItemModel["status"][],
): ChecklistQueryModel {
  return {
    categories: [
      {
        id: "wedding-hall",
        title: "웨딩홀",
        items: [],
        steps: statuses.map((status, index) => ({
          id: `step-${index + 1}`,
          order: index + 1,
          title: `단계 ${index + 1}`,
          items: [item(index + 1, status)],
        })),
        customItems: [],
      },
    ],
  };
}

describe("내 로드맵 뷰 모델", () => {
  it("완료한 단계 다음의 첫 미완료 카드만 현재 단계로 강조한다", () => {
    const [category] = createPersonalRoadmapViewModel(
      checklist(["done", "continue", "prev"]),
    );
    expect(category.groups.map((group) => group.isCurrent)).toEqual([
      false,
      true,
      false,
    ]);
    expect(category.completedCount).toBe(1);
    expect(category.groups[0].tasks[0].isComplete).toBe(true);
    expect(category.groups[1].tasks[0].statusLabel).toBe("진행 중");
  });

  it("모든 할 일이 완료됐으면 첫 번째 카드를 강조한다", () => {
    const [category] = createPersonalRoadmapViewModel(
      checklist(["done", "done"]),
    );
    expect(category.groups.map((group) => group.isCurrent)).toEqual([
      true,
      false,
    ]);
  });

  it("빈 단계는 카드에서 제외하되 전체 단계 수에 포함하고 직접 추가한 일을 강조한다", () => {
    const source = checklist(["done"]);
    source.categories[0].steps!.push({
      id: "step-2",
      order: 2,
      title: "빈 단계",
      items: [],
    });
    source.categories[0].customItems = [
      { ...item(3, "prev"), sourceCatalogItemId: null },
    ];
    const [category] = createPersonalRoadmapViewModel(source);
    expect(category.stepCount).toBe(2);
    expect(category.groups.map((group) => group.title)).toEqual([
      "단계 1",
      "내가 추가한 일",
    ]);
    expect(category.groups.map((group) => group.isCurrent)).toEqual([
      false,
      true,
    ]);
    expect(category.totalCount).toBe(2);
  });

  it("할 일이 없는 카테고리는 빈 카드 목록을 반환한다", () => {
    const [category] = createPersonalRoadmapViewModel(checklist([]));
    expect(category.groups).toEqual([]);
    expect(category.totalCount).toBe(0);
  });
});
