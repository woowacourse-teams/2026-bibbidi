import { describe, expect, it } from "vitest";

import type { MyChecklistItemModel } from "../../checklist";
import { preparationCatalogFixture as catalog } from "../test/fixtures/preparationCatalog.fixture";
import { createPreparationRoadmapViewModel } from "./createPreparationRoadmapViewModel";

function savedItem(
  sourceCatalogItemId: number | null,
  title: string,
): MyChecklistItemModel {
  return {
    id: sourceCatalogItemId ?? 1,
    categoryId: 10,
    sourceCatalogItemId,
    status: "done",
    title,
    createdAt: null,
    appointments: [],
  };
}

describe("로드맵 단계와 내 준비 조합", () => {
  it("담은 일이 없어도 카탈로그의 모든 단계를 순서대로 유지한다", () => {
    const { stages } = createPreparationRoadmapViewModel(
      catalog,
      "wedding-hall",
      {
        status: "ready",
        audience: "authenticated",
        items: [],
      },
    );
    expect(stages.map((stage) => stage.id)).toEqual([
      "step-1",
      "step-2",
      "step-3",
    ]);
    expect(
      stages.every(
        (stage) => stage.includedCount === 0 && stage.completedCount === 0,
      ),
    ).toBe(true);
  });

  it("완료율의 분모는 카탈로그에서 연결된 내 항목이고 저장된 제목과 완료 상태를 반영한다", () => {
    const {
      stages: [stage],
    } = createPreparationRoadmapViewModel(catalog, "wedding-hall", {
      status: "ready",
      audience: "authenticated",
      items: [
        savedItem(101, "수정한 투어"),
        savedItem(null, "직접 추가한 개인 준비"),
        savedItem(9999, "현재 카탈로그에 없는 개인 준비"),
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

  it.each(["unknown", "loading", "error"] as const)(
    "현황이 %s이면 담은 상태와 완료율을 알 수 없다",
    (status) => {
      const model = createPreparationRoadmapViewModel(catalog, "wedding-hall", {
        status,
      });
      expect(
        model.stages.every(
          (stage) =>
            stage.progress === undefined &&
            stage.includedCount === undefined &&
            stage.tasks.every((task) => task.isIncluded === undefined),
        ),
      ).toBe(true);
      expect(model.stages[0].statusLabel).toBe(
        status === "error" ? "현황 확인 필요" : "현황 확인 중",
      );
    },
  );

  it("게스트에게 담은 일의 다음 항목을 보여주고 완료율은 표시하지 않는다", () => {
    const model = createPreparationRoadmapViewModel(catalog, "wedding-hall", {
      status: "ready",
      audience: "guest",
      catalogItemIds: ["101"],
    });
    expect(model.stages[0].includedCount).toBe(1);
    expect(model.stages[0].nextTask?.id).toBe("101");
    expect(model.stages[0].previewLabel).toBe("다음 할 일");
    expect(model.stages[0].progress).toBeUndefined();
    expect(model.summary).not.toContain("완료");
  });

  it("단계가 없는 카테고리를 탭에서 제외한다", () => {
    const model = createPreparationRoadmapViewModel(
      {
        ...catalog,
        categories: [
          ...catalog.categories,
          { id: "empty", label: "빈 카테고리" },
        ],
      },
      "wedding-hall",
      { status: "unknown" },
    );
    expect(model.categories.some((item) => item.id === "empty")).toBe(false);
  });
});
