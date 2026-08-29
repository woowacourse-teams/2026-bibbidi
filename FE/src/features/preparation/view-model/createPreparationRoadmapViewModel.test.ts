import { describe, expect, it } from "vitest";
import {
  PreparationCatalogModel,
  PreparationStepProgressModel,
  PreparationStepStatus,
} from "../model/preparationRoadmap";
import {
  createPreparationRoadmapViewModel,
  getInitialSelectedStepId,
} from "./createPreparationRoadmapViewModel";

interface StepFixture {
  id: string;
  order: number;
}

function createCatalog(steps: StepFixture[]): PreparationCatalogModel {
  return {
    categories: [{ id: "wedding-hall", label: "웨딩홀" }],
    roadmap: {
      categoryId: "wedding-hall",
      steps: steps.map((step) => ({
        description: `${step.id} 설명`,
        id: step.id,
        order: step.order,
        title: `${step.id} 제목`,
      })),
      title: "웨딩홀 준비 로드맵",
    },
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

const unorderedSteps = [
  { id: "step-3", order: 3 },
  { id: "step-1", order: 1 },
  { id: "step-2", order: 2 },
];

describe("getInitialSelectedStepId", () => {
  it("진행 정보가 없으면 첫 번째 단계를 선택한다", () => {
    const model = createCatalog(unorderedSteps);

    expect(getInitialSelectedStepId(model)).toBe("step-1");
  });

  it("진행 중 단계가 여러 개면 순서가 가장 빠른 단계를 선택한다", () => {
    const model = createCatalog(unorderedSteps);
    const progress = createProgress([
      ["step-3", "in-progress"],
      ["step-2", "in-progress"],
    ]);

    expect(getInitialSelectedStepId(model, progress)).toBe("step-2");
  });

  it("모든 단계가 완료되면 마지막 단계를 선택한다", () => {
    const model = createCatalog(unorderedSteps);
    const progress = createProgress([
      ["step-1", "complete"],
      ["step-2", "complete"],
      ["step-3", "complete"],
    ]);

    expect(getInitialSelectedStepId(model, progress)).toBe("step-3");
  });

  it("완료와 예정만 있으면 첫 번째 단계를 선택한다", () => {
    const model = createCatalog(unorderedSteps);
    const progress = createProgress([
      ["step-1", "complete"],
      ["step-2", "upcoming"],
      ["step-3", "upcoming"],
    ]);

    expect(getInitialSelectedStepId(model, progress)).toBe("step-1");
  });

  it("선택할 단계가 없으면 오류를 발생시킨다", () => {
    const model = createCatalog([]);

    expect(() => getInitialSelectedStepId(model)).toThrow(
      "준비 로드맵에 선택할 단계가 없습니다.",
    );
  });
});

describe("createPreparationRoadmapViewModel", () => {
  it("진행 정보가 없으면 모든 단계를 예정으로 표시한다", () => {
    const model = createCatalog(unorderedSteps);

    const viewModel = createPreparationRoadmapViewModel(model, "step-1");

    expect(viewModel.steps.map((step) => step.status)).toEqual([
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(viewModel.selectedStepDetail.status).toBe("upcoming");
  });

  it("사용자 진행 상태를 단계와 상세 패널에 반영한다", () => {
    const model = createCatalog(unorderedSteps);
    const progress = createProgress([["step-2", "in-progress"]]);

    const viewModel = createPreparationRoadmapViewModel(
      model,
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
});
