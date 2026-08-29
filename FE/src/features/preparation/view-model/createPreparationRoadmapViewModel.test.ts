import { describe, expect, it } from "vitest";
import {
  PreparationCatalogModel,
  PreparationStepProgressModel,
  PreparationStepStatus,
} from "../model/preparationRoadmap";
import {
  createInitialPreparationRoadmapSelection,
  createPreparationRoadmapViewModel,
  getInitialSelectedCategoryId,
  getInitialSelectedStepId,
  selectAdjacentPreparationCategory,
  selectPreparationCategory,
} from "./createPreparationRoadmapViewModel";

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
          description: `${step.id} 설명`,
          id: step.id,
          order: step.order,
          title: `${step.id} 제목`,
        })),
        title: "웨딩홀 준비 로드맵",
      },
    ],
    stepDetails: steps.map((step) => ({
      description: `${step.id} 상세 설명`,
      stepId: step.id,
      tasks: [{ id: `${step.id}-task`, title: `${step.id} 할 일` }],
    })),
  };
}

function createProgress(
  entries: [string, PreparationStepStatus][],
): PreparationStepProgressModel[] {
  return entries.map(([stepId, status]) => ({ status, stepId }));
}

function addInvitationRoadmap(model: PreparationCatalogModel) {
  model.categories.push({ id: "invitation", label: "초대" });
  model.roadmaps.push({
    categoryId: "invitation",
    steps: [
      {
        description: "초대 설명",
        id: "invitation-step-1",
        order: 1,
        title: "초대 제목",
      },
    ],
    title: "초대 준비 로드맵",
  });
  model.stepDetails.push({
    description: "초대 상세 설명",
    stepId: "invitation-step-1",
    tasks: [{ id: "invitation-task-1", title: "초대 할 일" }],
  });
}

const unorderedSteps = [
  { id: "step-3", order: 3 },
  { id: "step-1", order: 1 },
  { id: "step-2", order: 2 },
];

describe("getInitialSelectedStepId", () => {
  it("진행 정보가 없으면 첫 번째 단계를 선택한다", () => {
    const model = createCatalog(unorderedSteps);

    expect(getInitialSelectedStepId(model, "wedding-hall")).toBe("step-1");
  });

  it("진행 중 단계가 여러 개면 순서가 가장 빠른 단계를 선택한다", () => {
    const model = createCatalog(unorderedSteps);
    const progress = createProgress([
      ["step-3", "in-progress"],
      ["step-2", "in-progress"],
    ]);

    expect(getInitialSelectedStepId(model, "wedding-hall", progress)).toBe(
      "step-2",
    );
  });

  it("모든 단계가 완료되면 마지막 단계를 선택한다", () => {
    const model = createCatalog(unorderedSteps);
    const progress = createProgress([
      ["step-1", "complete"],
      ["step-2", "complete"],
      ["step-3", "complete"],
    ]);

    expect(getInitialSelectedStepId(model, "wedding-hall", progress)).toBe(
      "step-3",
    );
  });

  it("완료와 예정만 있으면 첫 번째 단계를 선택한다", () => {
    const model = createCatalog(unorderedSteps);
    const progress = createProgress([
      ["step-1", "complete"],
      ["step-2", "upcoming"],
      ["step-3", "upcoming"],
    ]);

    expect(getInitialSelectedStepId(model, "wedding-hall", progress)).toBe(
      "step-1",
    );
  });

  it("선택할 단계가 없으면 오류를 발생시킨다", () => {
    const model = createCatalog([]);

    expect(() => getInitialSelectedStepId(model, "wedding-hall")).toThrow(
      "준비 로드맵에 선택할 단계가 없습니다.",
    );
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

  it("다음 방향으로 이동하면 다음 카테고리의 첫 단계를 선택한다", () => {
    const model = createCatalog(unorderedSteps);
    addInvitationRoadmap(model);

    expect(
      selectAdjacentPreparationCategory(
        model,
        { categoryId: "wedding-hall", stepId: "step-2" },
        "next",
      ),
    ).toEqual({
      categoryId: "invitation",
      stepId: "invitation-step-1",
    });
  });

  it("첫 번째와 마지막 카테고리의 바깥 방향에서는 선택을 유지한다", () => {
    const model = createCatalog(unorderedSteps);
    addInvitationRoadmap(model);
    const firstSelection = {
      categoryId: "wedding-hall",
      stepId: "step-2",
    };
    const lastSelection = {
      categoryId: "invitation",
      stepId: "invitation-step-1",
    };

    expect(
      selectAdjacentPreparationCategory(model, firstSelection, "previous"),
    ).toBe(firstSelection);
    expect(
      selectAdjacentPreparationCategory(model, lastSelection, "next"),
    ).toBe(lastSelection);
  });
});

describe("createPreparationRoadmapViewModel", () => {
  it("진행 정보가 없으면 모든 단계를 예정으로 표시한다", () => {
    const model = createCatalog(unorderedSteps);

    const viewModel = createPreparationRoadmapViewModel(
      model,
      "wedding-hall",
      "step-1",
    );

    expect(viewModel.steps.map((step) => step.status)).toEqual([
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(viewModel.selectedStepDetail.status).toBe("upcoming");
    expect(viewModel.categoryNavigation).toEqual({
      canNavigateNext: false,
      canNavigatePrevious: false,
    });
  });

  it("사용자 진행 상태를 단계와 상세 패널에 반영한다", () => {
    const model = createCatalog(unorderedSteps);
    const progress = createProgress([["step-2", "in-progress"]]);

    const viewModel = createPreparationRoadmapViewModel(
      model,
      "wedding-hall",
      "step-2",
      progress,
    );

    expect(viewModel.steps.find((step) => step.id === "step-2")).toMatchObject({
      status: "in-progress",
      statusLabel: "진행 중",
    });
    expect(viewModel.selectedStepDetail).toMatchObject({
      status: "in-progress",
      statusLabel: "진행 중",
    });
  });

  it("로드맵이 없는 카테고리를 표시와 이동 경계에서 제외한다", () => {
    const model = createCatalog(unorderedSteps);
    model.categories.push({ id: "without-roadmap", label: "준비 중" });
    addInvitationRoadmap(model);

    const firstCategoryViewModel = createPreparationRoadmapViewModel(
      model,
      "wedding-hall",
      "step-1",
    );
    const lastCategoryViewModel = createPreparationRoadmapViewModel(
      model,
      "invitation",
      "invitation-step-1",
    );

    expect(
      firstCategoryViewModel.categories.map((category) => category.id),
    ).toEqual(["wedding-hall", "invitation"]);
    expect(firstCategoryViewModel.categoryNavigation).toEqual({
      canNavigateNext: true,
      canNavigatePrevious: false,
    });
    expect(lastCategoryViewModel.categoryNavigation).toEqual({
      canNavigateNext: false,
      canNavigatePrevious: true,
    });
    expect(
      selectAdjacentPreparationCategory(
        model,
        { categoryId: "wedding-hall", stepId: "step-1" },
        "next",
      ),
    ).toEqual({
      categoryId: "invitation",
      stepId: "invitation-step-1",
    });
  });
});
