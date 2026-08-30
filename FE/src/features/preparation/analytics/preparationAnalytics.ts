import type { AnalyticsEvent } from "../../../infrastructure/analytics";
import type { PreparationCategoryNavigationDirection } from "../model/preparationRoadmap";

export type PreparationCategoryInputMethod = "button" | "wheel";
export type PreparationCategorySelectionDirection =
  PreparationCategoryNavigationDirection | "direct";

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
  direction: PreparationCategorySelectionDirection;
  inputMethod: PreparationCategoryInputMethod;
  previousCategoryId: string;
}

export function createPreparationCategorySelectEvent({
  categoryId,
  direction,
  inputMethod,
  previousCategoryId,
}: CreatePreparationCategorySelectEventParameters): AnalyticsEvent {
  return {
    name: "preparation_category_select",
    parameters: {
      category_id: categoryId,
      direction,
      input_method: inputMethod,
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
