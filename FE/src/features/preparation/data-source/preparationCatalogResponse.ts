import { PreparationCatalogModel } from "../model/preparationRoadmap";

interface PreparationCatalogItemResponse {
  displayOrder: number;
  essential: boolean;
  id: number;
  included?: boolean;
  title: string;
}

interface PreparationCatalogStepResponse {
  description?: string | null;
  displayOrder: number;
  iconUrl?: string | null;
  id: number;
  items: PreparationCatalogItemResponse[];
  name: string;
}

interface PreparationCatalogCategoryResponse {
  displayOrder: number;
  id: number;
  name: string;
  steps: PreparationCatalogStepResponse[];
}

interface RemotePreparationCatalogResponse {
  categories: PreparationCatalogCategoryResponse[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function isOptionalNullableString(
  value: unknown,
): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isPreparationCatalogItem(
  value: unknown,
  requiresIncluded: boolean,
): value is PreparationCatalogItemResponse {
  return (
    isRecord(value) &&
    typeof value.displayOrder === "number" &&
    typeof value.essential === "boolean" &&
    typeof value.id === "number" &&
    (requiresIncluded
      ? typeof value.included === "boolean"
      : isOptionalBoolean(value.included)) &&
    typeof value.title === "string"
  );
}

function isPreparationCatalogStep(
  value: unknown,
  requiresIncluded: boolean,
): value is PreparationCatalogStepResponse {
  return (
    isRecord(value) &&
    isOptionalNullableString(value.description) &&
    typeof value.displayOrder === "number" &&
    isOptionalNullableString(value.iconUrl) &&
    typeof value.id === "number" &&
    Array.isArray(value.items) &&
    value.items.every((item) =>
      isPreparationCatalogItem(item, requiresIncluded),
    ) &&
    typeof value.name === "string"
  );
}

function isPreparationCatalogCategory(
  value: unknown,
  requiresIncluded: boolean,
): value is PreparationCatalogCategoryResponse {
  return (
    isRecord(value) &&
    typeof value.displayOrder === "number" &&
    typeof value.id === "number" &&
    typeof value.name === "string" &&
    Array.isArray(value.steps) &&
    value.steps.every((step) =>
      isPreparationCatalogStep(step, requiresIncluded),
    )
  );
}

function isPreparationCatalogResponse(
  value: unknown,
  requiresIncluded: boolean,
): value is RemotePreparationCatalogResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.categories) &&
    value.categories.every((category) =>
      isPreparationCatalogCategory(category, requiresIncluded),
    )
  );
}

function byDisplayOrder(
  first: { displayOrder: number },
  second: { displayOrder: number },
) {
  return first.displayOrder - second.displayOrder;
}

export function parsePreparationCatalogResponse(
  value: unknown,
  { requiresIncluded = false }: { requiresIncluded?: boolean } = {},
): PreparationCatalogModel {
  if (!isPreparationCatalogResponse(value, requiresIncluded)) {
    throw new Error("준비 목록 성공 응답 형식이 올바르지 않습니다.");
  }

  const categories = [...value.categories].sort(byDisplayOrder);

  return {
    categories: categories.map((category) => ({
      id: String(category.id),
      label: category.name,
    })),
    roadmaps: categories.map((category) => ({
      categoryId: String(category.id),
      steps: [...category.steps].sort(byDisplayOrder).map((step) => ({
        id: String(step.id),
        iconUrl: step.iconUrl ?? undefined,
        order: step.displayOrder,
        title: step.name,
      })),
    })),
    stepDetails: categories.flatMap((category) =>
      [...category.steps].sort(byDisplayOrder).map((step) => ({
        description: step.description ?? "",
        stepId: String(step.id),
        tasks: [...step.items].sort(byDisplayOrder).map((item) => ({
          essential: item.essential,
          id: String(item.id),
          included: item.included,
          title: item.title,
        })),
      })),
    ),
  };
}
