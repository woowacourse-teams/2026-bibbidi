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

interface CreatePreparationItemAddEventParameters {
  categoryId: string;
  itemCount: number;
  stepId: string;
  stepOrder: number;
}

export function createPreparationItemAddEvent({
  categoryId,
  itemCount,
  stepId,
  stepOrder,
}: CreatePreparationItemAddEventParameters): AnalyticsEvent {
  return {
    name: "preparation_item_add",
    parameters: {
      category_id: categoryId,
      item_count: itemCount,
      source: "preparation",
      step_id: stepId,
      step_order: stepOrder,
    },
  };
}
