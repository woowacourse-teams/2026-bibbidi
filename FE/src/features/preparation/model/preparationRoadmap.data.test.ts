import { describe, expect, it } from "vitest";
import { preparationRoadmapData } from "./preparationRoadmap.data";

describe("preparationRoadmapData", () => {
  it("전체 준비 카탈로그를 카테고리 순서대로 제공한다", () => {
    expect(preparationRoadmapData.categories.map(({ label }) => label)).toEqual(
      ["웨딩홀", "스드메", "초대", "가족", "기타"],
    );
    expect(
      preparationRoadmapData.roadmaps.map(({ steps }) => steps.length),
    ).toEqual([9, 9, 9, 7, 9]);
  });

  it("43개 단계와 169개 상세 할 일을 중복 없이 제공한다", () => {
    const stepIds = preparationRoadmapData.roadmaps.flatMap(({ steps }) =>
      steps.map(({ id }) => id),
    );
    const detailStepIds = preparationRoadmapData.stepDetails.map(
      ({ stepId }) => stepId,
    );
    const taskIds = preparationRoadmapData.stepDetails.flatMap(({ tasks }) =>
      tasks.map(({ id }) => id),
    );

    expect(stepIds).toHaveLength(43);
    expect(new Set(stepIds).size).toBe(43);
    expect(preparationRoadmapData.stepDetails).toHaveLength(43);
    expect(new Set(detailStepIds)).toEqual(new Set(stepIds));
    expect(taskIds).toHaveLength(169);
    expect(new Set(taskIds).size).toBe(169);
  });

  it("각 로드맵의 단계를 표시 순서대로 제공한다", () => {
    for (const roadmap of preparationRoadmapData.roadmaps) {
      expect(roadmap.steps.map(({ order }) => order)).toEqual(
        Array.from({ length: roadmap.steps.length }, (_, index) => index + 1),
      );
    }
  });
});
