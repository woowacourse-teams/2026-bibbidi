import { describe, expect, it } from "vitest";
import { applyChecklistCatalogItemIds } from "../model/preparationRoadmap";
import { preparationCatalogFixture } from "../test/fixtures/preparationCatalog.fixture";
import { createGuestPersonalRoadmapViewModel } from "./createGuestPersonalRoadmapViewModel";

describe("비로그인 내 로드맵 뷰 모델", () => {
  it("담긴 항목만 카탈로그 단계 순서로 묶고 빈 단계는 전체 단계 수에만 포함한다", () => {
    const catalog = applyChecklistCatalogItemIds(preparationCatalogFixture, [
      "301",
      "101",
      "1001",
    ]);
    catalog.roadmaps = catalog.roadmaps.map((roadmap) => ({
      ...roadmap,
      steps: [...roadmap.steps].reverse(),
    }));

    const result = createGuestPersonalRoadmapViewModel(catalog, "wedding-hall");

    expect(result.stepCount).toBe(3);
    expect(result.totalCount).toBe(2);
    expect(result.groups.map((group) => group.numberLabel)).toEqual([
      "01",
      "03",
    ]);
    expect(
      result.groups.flatMap((group) => group.tasks.map((task) => task.id)),
    ).toEqual(["101", "301"]);
    expect(
      createGuestPersonalRoadmapViewModel(catalog, "studio-dress-makeup")
        .groups[0].tasks[0].id,
    ).toBe("1001");
  });

  it("담은 항목이 없으면 단계 수를 유지하고 빈 목록을 반환한다", () => {
    const catalog = applyChecklistCatalogItemIds(preparationCatalogFixture, []);

    expect(
      createGuestPersonalRoadmapViewModel(catalog, "wedding-hall"),
    ).toEqual({
      groups: [],
      stepCount: 3,
      totalCount: 0,
    });
  });
});
