import type { AnalyticsEvent } from "../../../infrastructure/analytics";

export function createPreparationCatalogViewEvent(
  initialCategoryId: string,
): AnalyticsEvent {
  return {
    name: "preparation_catalog_view",
    parameters: {
      initial_category_id: initialCategoryId,
    },
  };
}

interface CreatePreparationCategorySelectEventParameters {
  categoryId: string;
  previousCategoryId: string;
}

export function createPreparationCategorySelectEvent({
  categoryId,
  previousCategoryId,
}: CreatePreparationCategorySelectEventParameters): AnalyticsEvent {
  return {
    name: "preparation_category_select",
    parameters: {
      category_id: categoryId,
      direction: "direct",
      input_method: "button",
      previous_category_id: previousCategoryId,
    },
  };
}

interface CreatePreparationStepSelectEventParameters {
  categoryId: string;
  stepId: string;
  stepOrder: number;
}

export function createPreparationStepSelectEvent({
  categoryId,
  stepId,
  stepOrder,
}: CreatePreparationStepSelectEventParameters): AnalyticsEvent {
  return {
    name: "preparation_step_select",
    parameters: {
      category_id: categoryId,
      step_id: stepId,
      step_order: stepOrder,
    },
  };
}

type CreatePreparationItemAddEventParameters =
  | {
      categoryId: string;
      itemCount: number;
      source?: "preparation";
      stepId: string;
      stepOrder: number;
    }
  | {
      categoryName: string;
      itemCount: number;
      phase: number;
      source: "planner_recommendation";
    };

export function createPreparationItemAddEvent(
  parameters: CreatePreparationItemAddEventParameters,
): AnalyticsEvent {
  if (parameters.source === "planner_recommendation") {
    return {
      name: "preparation_item_add",
      parameters: {
        category_name: parameters.categoryName,
        item_count: parameters.itemCount,
        phase: parameters.phase,
        source: parameters.source,
      },
    };
  }

  const {
    categoryId,
    itemCount,
    source = "preparation",
    stepId,
    stepOrder,
  } = parameters;

  return {
    name: "preparation_item_add",
    parameters: {
      category_id: categoryId,
      item_count: itemCount,
      source,
      step_id: stepId,
      step_order: stepOrder,
    },
  };
}
