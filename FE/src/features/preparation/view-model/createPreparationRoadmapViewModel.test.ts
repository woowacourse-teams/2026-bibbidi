import { describe, expect, it } from "vitest";
import {
  createPreparationRoadmapViewModel,
  type RoadmapProgressStatus,
} from "./createPreparationRoadmapViewModel";
import type { ChecklistQueryModel } from "../../checklist/model/checklistQuery";
import type { PreparationCatalogModel } from "../model/preparationRoadmap";
function stagesFor(
  catalog: PreparationCatalogModel,
  categoryId: string,
  checklist?: ChecklistQueryModel,
) {
  return createPreparationRoadmapViewModel(catalog, categoryId, {
    checklist,
    isGuest: !checklist,
    progressStatus: "ready",
  }).stages;
}
import { preparationCatalogFixture } from "../test/fixtures/preparationCatalog.fixture";
import { applyChecklistCatalogItemIds } from "../model/preparationRoadmap";

describe("로드맵 단계와 내 준비 조합", () => {
  it("담은 일이 없어도 카탈로그의 모든 단계를 순서대로 유지한다", () => {
    const model = applyChecklistCatalogItemIds(preparationCatalogFixture, []);
    const result = stagesFor(model, "wedding-hall");
    expect(result.map((s) => s.id)).toEqual(["step-1", "step-2", "step-3"]);
    expect(
      result.every((s) => s.includedCount === 0 && s.completedCount === 0),
    ).toBe(true);
  });
  it("완료율의 분모는 선택한 항목이고 저장된 제목과 완료 상태를 반영한다", () => {
    const [stage] = stagesFor(preparationCatalogFixture, "wedding-hall", {
      categories: [
        {
          id: "wedding-hall",
          title: "웨딩홀",
          items: [
            {
              id: "saved-1",
              checklistItemId: 1,
              categoryId: "wedding-hall",
              sourceCatalogItemId: 101,
              status: "done",
              title: "수정한 투어",
              appointments: [],
            },
          ],
        },
      ],
    });
    expect(stage.tasks).toHaveLength(2);
    expect(stage.includedCount).toBe(1);
    expect(stage.completedCount).toBe(1);
    expect(stage.isComplete).toBe(true);
    expect(stage.statusLabel).toBe("내 할 일 완료");
    expect(stage.progress).toBe(1);
    expect(stage.nextTask?.id).toBe("102");
    expect(stage.previewLabel).toBe("준비할 일");
    expect(stage.tasks[0]).toMatchObject({
      title: "수정한 투어",
      isComplete: true,
      isIncluded: true,
    });
    expect(stage.tasks[1].isIncluded).toBe(false);
  });
  it("게스트의 담은 항목을 완료로 계산하지 않는다", () => {
    const [stage] = stagesFor(preparationCatalogFixture, "wedding-hall");
    expect(stage.includedCount).toBe(1);
    expect(stage.completedCount).toBe(0);
  });
  it("사용자 작성 항목을 임의의 준비 단계에 넣지 않는다", () => {
    const stages = stagesFor(preparationCatalogFixture, "wedding-hall", {
      categories: [
        {
          id: "wedding-hall",
          title: "웨딩홀",
          items: [
            {
              id: "custom",
              checklistItemId: 1,
              categoryId: "wedding-hall",
              sourceCatalogItemId: null,
              title: "개인 준비",
              status: "done",
              appointments: [],
            },
          ],
        },
      ],
    });
    expect(
      stages.flatMap((s) => s.tasks).some((t) => t.title === "개인 준비"),
    ).toBe(false);
  });
});

describe("로드맵 표시 정책", () => {
  it.each(["loading", "error"] as const)(
    "현황이 %s이면 완료율을 표시하지 않는다",
    (progressStatus: RoadmapProgressStatus) => {
      const model = createPreparationRoadmapViewModel(
        preparationCatalogFixture,
        "wedding-hall",
        { isGuest: false, progressStatus },
      );
      expect(
        model.stages.every(
          (stage) => stage.progress === undefined && !stage.isComplete,
        ),
      ).toBe(true);
      expect(model.stages[0].statusLabel).toBe(
        progressStatus === "loading" ? "현황 확인 중" : "현황 확인 필요",
      );
      expect(model.summary).toContain(
        progressStatus === "loading" ? "확인 중" : "확인 필요",
      );
    },
  );
  it("게스트에게 담은 일의 다음 항목을 보여주고 완료율은 표시하지 않는다", () => {
    const model = createPreparationRoadmapViewModel(
      preparationCatalogFixture,
      "wedding-hall",
      { isGuest: true, progressStatus: "ready" },
    );
    expect(model.stages[0].nextTask?.id).toBe("101");
    expect(model.stages[0].previewLabel).toBe("다음 할 일");
    expect(model.stages[0].progress).toBeUndefined();
    expect(model.summary).not.toContain("완료");
  });
  it("단계가 없는 카테고리를 탭에서 제외한다", () => {
    const catalog = {
      ...preparationCatalogFixture,
      categories: [
        ...preparationCatalogFixture.categories,
        { id: "empty", label: "빈 카테고리" },
      ],
    };
    const model = createPreparationRoadmapViewModel(catalog, "wedding-hall", {
      isGuest: false,
      progressStatus: "ready",
    });
    expect(model.categories.some((item) => item.id === "empty")).toBe(false);
  });
});
