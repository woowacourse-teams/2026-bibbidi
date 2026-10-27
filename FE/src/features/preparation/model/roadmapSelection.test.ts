import { describe, expect, it } from "vitest";
import type { PreparationCatalogModel } from "./preparationRoadmap";
import {
  createInitialPreparationRoadmapSelection,
  getInitialSelectedCategoryId,
  getInitialSelectedStepId,
  selectPreparationCategory,
} from "./roadmapSelection";
interface StepFixture {
  id: string;
  order: number;
}

function createCatalog(steps: StepFixture[]): PreparationCatalogModel {
  return {
    categories: [{ id: "wedding-hall", label: "웨딩홀" }],
    roadmaps: [
      {
        categoryId: "wedding-hall",
        steps: steps.map((step) => ({
          id: step.id,
          iconUrl:
            step.id === "step-1" ? "https://example.com/step-1.png" : undefined,
          order: step.order,
          title: `${step.id} 제목`,
        })),
      },
    ],
    stepDetails: steps.map((step) => ({
      description: `${step.id} 상세 설명`,
      stepId: step.id,
      tasks: [
        {
          id: `${step.id}-task`,
          included: false,
          title: `${step.id} 할 일`,
        },
      ],
    })),
  };
}

function addInvitationRoadmap(model: PreparationCatalogModel) {
  model.categories.push({ id: "invitation", label: "초대" });
  model.roadmaps.push({
    categoryId: "invitation",
    steps: [
      {
        id: "invitation-step-1",
        order: 1,
        title: "초대 제목",
      },
    ],
  });
  model.stepDetails.push({
    description: "초대 상세 설명",
    stepId: "invitation-step-1",
    tasks: [{ id: "invitation-task-1", included: false, title: "초대 할 일" }],
  });
}

const unorderedSteps = [
  { id: "step-3", order: 3 },
  { id: "step-1", order: 1 },
  { id: "step-2", order: 2 },
];

describe("단계 최초 선택", () => {
  it("카탈로그 순서가 가장 빠른 단계를 선택한다", () => {
    expect(
      getInitialSelectedStepId(createCatalog(unorderedSteps), "wedding-hall"),
    ).toBe("step-1");
  });
  it("선택할 단계가 없으면 오류를 발생시킨다", () => {
    expect(() =>
      getInitialSelectedStepId(createCatalog([]), "wedding-hall"),
    ).toThrow("준비 로드맵에 선택할 단계가 없습니다.");
  });
});
describe("카테고리 선택", () => {
  it("표시 순서가 가장 빠른 카테고리를 최초 선택한다", () => {
    const model = createCatalog(unorderedSteps);

    expect(getInitialSelectedCategoryId(model)).toBe("wedding-hall");
    expect(createInitialPreparationRoadmapSelection(model)).toEqual({
      categoryId: "wedding-hall",
      stepId: "step-1",
    });
  });

  it("카테고리를 변경하면 변경된 로드맵의 첫 단계를 선택한다", () => {
    const model = createCatalog(unorderedSteps);
    addInvitationRoadmap(model);

    expect(
      selectPreparationCategory(
        model,
        { categoryId: "wedding-hall", stepId: "step-2" },
        "invitation",
      ),
    ).toEqual({
      categoryId: "invitation",
      stepId: "invitation-step-1",
    });
  });

  it("같은 카테고리를 다시 선택하면 현재 단계를 유지한다", () => {
    const model = createCatalog(unorderedSteps);
    const currentSelection = {
      categoryId: "wedding-hall",
      stepId: "step-2",
    };

    expect(
      selectPreparationCategory(model, currentSelection, "wedding-hall"),
    ).toBe(currentSelection);
  });
});
