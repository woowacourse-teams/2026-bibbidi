import { describe, expect, it } from "vitest";
import {
  createPreparationCatalogViewEvent,
  createPreparationCategorySelectEvent,
  createPreparationItemAddEvent,
  createPreparationStepSelectEvent,
} from "./preparationAnalytics";

describe("준비 목록 Analytics 이벤트", () => {
  it("준비 목록 진입 이벤트를 생성한다", () => {
    expect(createPreparationCatalogViewEvent("wedding-hall")).toEqual({
      name: "preparation_catalog_view",
      parameters: {
        initial_category_id: "wedding-hall",
      },
    });
  });

  it("버튼으로 직접 선택한 카테고리 이벤트를 생성한다", () => {
    expect(
      createPreparationCategorySelectEvent({
        categoryId: "invitation",
        previousCategoryId: "studio-dress-makeup",
      }),
    ).toEqual({
      name: "preparation_category_select",
      parameters: {
        category_id: "invitation",
        direction: "direct",
        input_method: "button",
        previous_category_id: "studio-dress-makeup",
      },
    });
  });

  it("선택한 단계의 카테고리와 순서를 포함한 이벤트를 생성한다", () => {
    expect(
      createPreparationStepSelectEvent({
        categoryId: "invitation",
        stepId: "step-20",
        stepOrder: 2,
      }),
    ).toEqual({
      name: "preparation_step_select",
      parameters: {
        category_id: "invitation",
        step_id: "step-20",
        step_order: 2,
      },
    });
  });

  it("추가된 항목의 식별자 없이 실제 성공 개수를 포함한 이벤트를 생성한다", () => {
    expect(
      createPreparationItemAddEvent({
        categoryId: "invitation",
        itemCount: 2,
        stepId: "step-20",
        stepOrder: 2,
      }),
    ).toEqual({
      name: "preparation_item_add",
      parameters: {
        category_id: "invitation",
        item_count: 2,
        source: "preparation",
        step_id: "step-20",
        step_order: 2,
      },
    });
  });

  it("플래너 추천 추가도 같은 이벤트 계약에서 공개 분류와 유입만 구분한다", () => {
    expect(
      createPreparationItemAddEvent({
        categoryName: "웨딩홀",
        itemCount: 1,
        phase: 3,
        source: "planner_recommendation",
      }),
    ).toEqual({
      name: "preparation_item_add",
      parameters: {
        category_name: "웨딩홀",
        item_count: 1,
        phase: 3,
        source: "planner_recommendation",
      },
    });
  });
});
