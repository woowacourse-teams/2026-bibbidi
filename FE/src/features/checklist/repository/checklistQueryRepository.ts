import { CatalogModel } from "../../catalog/model/catalog";
import { CatalogRepository } from "../../catalog/repository/catalogRepository";
import { RemoteCatalogRequestAbortedError } from "../../catalog/data-source/remoteCatalogDataSource";
import { LocalChecklistDataSource } from "../data-source/localChecklistDataSource";
import {
  ChecklistAudience,
  ChecklistQueryCategoryModel,
  ChecklistQueryItemModel,
  ChecklistQueryModel,
  ChecklistQueryStepModel,
} from "../model/checklistQuery";
import { MyChecklistItemModel } from "../model/myChecklist";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistQueryRepository,
  MyChecklistRequestAbortedError,
} from "./myChecklistQueryRepository";

export class ChecklistQueryAuthenticationRequiredError extends Error {
  constructor(options?: ErrorOptions) {
    super("로그인이 필요합니다.", options);
    this.name = "ChecklistQueryAuthenticationRequiredError";
  }
}

export class ChecklistQueryLoadError extends Error {
  constructor(
    message = "체크리스트를 불러오지 못했습니다.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ChecklistQueryLoadError";
  }
}

export class ChecklistQueryRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 요청이 취소됐습니다.", options);
    this.name = "ChecklistQueryRequestAbortedError";
  }
}

export class UnknownChecklistCategoryError extends ChecklistQueryLoadError {
  constructor(readonly categoryId: number) {
    super(
      `체크리스트 항목의 카테고리를 Catalog에서 찾을 수 없습니다: ${categoryId}`,
    );
    this.name = "UnknownChecklistCategoryError";
  }
}

export class UnknownChecklistCatalogItemError extends ChecklistQueryLoadError {
  constructor(readonly catalogItemId: number) {
    super(
      `체크리스트 항목의 원본 항목을 Catalog에서 찾을 수 없습니다: ${catalogItemId}`,
    );
    this.name = "UnknownChecklistCatalogItemError";
  }
}

export interface ChecklistQueryRepository {
  getChecklist(
    audience: ChecklistAudience,
    signal?: AbortSignal,
  ): Promise<ChecklistQueryModel>;
}

function toChecklistQueryError(error: unknown, signal?: AbortSignal): Error {
  if (
    signal?.aborted ||
    error instanceof MyChecklistRequestAbortedError ||
    error instanceof RemoteCatalogRequestAbortedError
  ) {
    return new ChecklistQueryRequestAbortedError({ cause: error });
  }

  if (
    error instanceof ChecklistQueryLoadError ||
    error instanceof ChecklistQueryAuthenticationRequiredError ||
    error instanceof ChecklistQueryRequestAbortedError
  ) {
    return error;
  }

  if (error instanceof MyChecklistAuthenticationRequiredError) {
    return new ChecklistQueryAuthenticationRequiredError({ cause: error });
  }

  return new ChecklistQueryLoadError(undefined, { cause: error });
}

function getCatalogStructure(catalog: CatalogModel) {
  const stepDetailsById = new Map(
    catalog.stepDetails.map((stepDetail) => [stepDetail.stepId, stepDetail]),
  );

  return catalog.categories.map((category) => {
    const roadmap = catalog.roadmaps.find(
      (candidate) => candidate.categoryId === category.id,
    );

    return {
      category,
      steps: [...(roadmap?.steps ?? [])]
        .sort((left, right) => left.order - right.order)
        .map((step) => ({
          ...step,
          catalogItems: stepDetailsById.get(step.id)?.tasks ?? [],
        })),
    };
  });
}

function toAuthenticatedItem(item: MyChecklistItemModel) {
  return {
    appointments: item.appointments.map((appointment) => ({ ...appointment })),
    categoryId: String(item.categoryId),
    checklistItemId: item.id,
    createdAt: item.createdAt,
    id: `checklist-item-${item.id}`,
    sourceCatalogItemId: item.sourceCatalogItemId,
    status: item.status,
    title: item.title,
  } satisfies ChecklistQueryItemModel;
}

function createGroupedCategory(
  id: string,
  title: string,
  steps: ChecklistQueryStepModel[],
  customItems: ChecklistQueryItemModel[],
): ChecklistQueryCategoryModel {
  return {
    customItems,
    id,
    get items() {
      return [...steps.flatMap((step) => step.items), ...customItems];
    },
    steps,
    title,
  };
}

function assembleGuestChecklist(
  catalog: CatalogModel,
  catalogItemIds: number[],
): ChecklistQueryModel {
  const selectedCatalogItemIds = new Set(catalogItemIds);
  const catalogStructure = getCatalogStructure(catalog);
  const knownCatalogItemIds = new Set(
    catalogStructure.flatMap(({ steps }) =>
      steps.flatMap((step) => step.catalogItems.map((item) => Number(item.id))),
    ),
  );

  for (const catalogItemId of selectedCatalogItemIds) {
    if (!knownCatalogItemIds.has(catalogItemId)) {
      throw new UnknownChecklistCatalogItemError(catalogItemId);
    }
  }

  return {
    categories: catalogStructure.map(({ category, steps }) => {
      const querySteps = steps.map((step) => ({
        id: step.id,
        items: step.catalogItems.flatMap((item): ChecklistQueryItemModel[] => {
          const catalogItemId = Number(item.id);

          if (!selectedCatalogItemIds.has(catalogItemId)) {
            return [];
          }

          return [
            {
              appointments: [],
              categoryId: category.id,
              checklistItemId: null,
              createdAt: null,
              id: `catalog-item-${catalogItemId}`,
              sourceCatalogItemId: catalogItemId,
              status: "prev",
              title: item.title,
            },
          ];
        }),
        order: step.order,
        title: step.title,
      }));

      return createGroupedCategory(category.id, category.label, querySteps, []);
    }),
  };
}

function assembleAuthenticatedChecklist(
  catalog: CatalogModel,
  checklistItems: MyChecklistItemModel[],
): ChecklistQueryModel {
  const catalogCategoryIds = new Set(
    catalog.categories.map((category) => category.id),
  );

  for (const item of checklistItems) {
    if (!catalogCategoryIds.has(String(item.categoryId))) {
      throw new UnknownChecklistCategoryError(item.categoryId);
    }
  }

  const catalogStructure = getCatalogStructure(catalog);
  const catalogLocationByItemId = new Map(
    catalogStructure.flatMap(({ category, steps }) =>
      steps.flatMap((step) =>
        step.catalogItems.map(
          (item) =>
            [
              Number(item.id),
              { categoryId: category.id, stepId: step.id },
            ] as const,
        ),
      ),
    ),
  );

  for (const item of checklistItems) {
    if (item.sourceCatalogItemId === null) {
      continue;
    }

    const location = catalogLocationByItemId.get(item.sourceCatalogItemId);

    if (!location || location.categoryId !== String(item.categoryId)) {
      throw new UnknownChecklistCatalogItemError(item.sourceCatalogItemId);
    }
  }

  return {
    categories: catalogStructure.map(({ category, steps }) => {
      const customItems = checklistItems
        .filter(
          (item) =>
            String(item.categoryId) === category.id &&
            item.sourceCatalogItemId === null,
        )
        .sort(
          (left, right) =>
            (left.createdAt ?? "").localeCompare(right.createdAt ?? "") ||
            left.id - right.id,
        )
        .map(toAuthenticatedItem);
      const querySteps = steps.map((step) => ({
        id: step.id,
        items: step.catalogItems.flatMap(
          (catalogItem): ChecklistQueryItemModel[] => {
            const item = checklistItems.find(
              (candidate) =>
                candidate.sourceCatalogItemId === Number(catalogItem.id),
            );

            return item ? [toAuthenticatedItem(item)] : [];
          },
        ),
        order: step.order,
        title: step.title,
      }));

      return createGroupedCategory(
        category.id,
        category.label,
        querySteps,
        customItems,
      );
    }),
  };
}

export function createChecklistQueryRepository(
  catalogRepository: CatalogRepository,
  localChecklistDataSource: LocalChecklistDataSource,
  myChecklistQueryRepository: MyChecklistQueryRepository,
): ChecklistQueryRepository {
  return {
    async getChecklist(audience, signal) {
      try {
        if (audience === "guest") {
          const catalogItemIds = localChecklistDataSource.getCatalogItemIds();
          const catalog = await catalogRepository.getCatalog(signal);

          return assembleGuestChecklist(catalog, catalogItemIds);
        }

        const [catalog, checklist] = await Promise.all([
          catalogRepository.getCatalog(signal),
          myChecklistQueryRepository.getChecklist(signal),
        ]);

        return assembleAuthenticatedChecklist(catalog, checklist.items);
      } catch (error) {
        throw toChecklistQueryError(error, signal);
      }
    },
  };
}
