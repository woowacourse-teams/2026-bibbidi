import { CatalogModel } from "../model/catalog";

interface CatalogItemResponse {
  displayOrder: number;
  essential: boolean;
  id: number;
  title: string;
}

interface CatalogStepResponse {
  description?: string | null;
  displayOrder: number;
  iconUrl?: string | null;
  id: number;
  items: CatalogItemResponse[];
  name: string;
}

interface CatalogCategoryResponse {
  displayOrder: number;
  id: number;
  name: string;
  steps: CatalogStepResponse[];
}

interface RemoteCatalogResponse {
  categories: CatalogCategoryResponse[];
}

export class CatalogContractError extends Error {
  constructor() {
    super("Catalog 성공 응답 형식이 올바르지 않습니다.");
    this.name = "CatalogContractError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionalNullableString(
  value: unknown,
): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isCatalogItem(value: unknown): value is CatalogItemResponse {
  return (
    isRecord(value) &&
    typeof value.displayOrder === "number" &&
    typeof value.essential === "boolean" &&
    typeof value.id === "number" &&
    typeof value.title === "string"
  );
}

function isCatalogStep(value: unknown): value is CatalogStepResponse {
  return (
    isRecord(value) &&
    isOptionalNullableString(value.description) &&
    typeof value.displayOrder === "number" &&
    isOptionalNullableString(value.iconUrl) &&
    typeof value.id === "number" &&
    Array.isArray(value.items) &&
    value.items.every(isCatalogItem) &&
    typeof value.name === "string"
  );
}

function isCatalogCategory(value: unknown): value is CatalogCategoryResponse {
  return (
    isRecord(value) &&
    typeof value.displayOrder === "number" &&
    typeof value.id === "number" &&
    typeof value.name === "string" &&
    Array.isArray(value.steps) &&
    value.steps.every(isCatalogStep)
  );
}

function isCatalogResponse(value: unknown): value is RemoteCatalogResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.categories) &&
    value.categories.every(isCatalogCategory)
  );
}

function byDisplayOrder(
  first: { displayOrder: number },
  second: { displayOrder: number },
) {
  return first.displayOrder - second.displayOrder;
}

export function parseCatalogResponse(value: unknown): CatalogModel {
  if (!isCatalogResponse(value)) {
    throw new CatalogContractError();
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
          title: item.title,
        })),
      })),
    ),
  };
}
