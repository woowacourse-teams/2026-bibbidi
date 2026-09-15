import { CatalogModel } from "../../catalog/model/catalog";
import { CatalogRepository } from "../../catalog/repository/catalogRepository";
import { LocalChecklistDataSource } from "../data-source/localChecklistDataSource";
import {
  ChecklistAudience,
  ChecklistQueryItemModel,
  ChecklistQueryModel,
} from "../model/checklistQuery";
import { MyChecklistItemModel } from "../model/myChecklist";
import { MyChecklistQueryRepository } from "./myChecklistQueryRepository";

export class UnknownChecklistCategoryError extends Error {
  constructor(readonly categoryId: number) {
    super(
      `체크리스트 항목의 카테고리를 Catalog에서 찾을 수 없습니다: ${categoryId}`,
    );
    this.name = "UnknownChecklistCategoryError";
  }
}

export interface ChecklistQueryRepository {
  getChecklist(
    audience: ChecklistAudience,
    signal?: AbortSignal,
  ): Promise<ChecklistQueryModel>;
}

function getCatalogItemsByCategory(
  catalog: CatalogModel,
  selectedCatalogItemIds: ReadonlySet<number>,
) {
  const stepDetailsById = new Map(
    catalog.stepDetails.map((stepDetail) => [stepDetail.stepId, stepDetail]),
  );

  return new Map(
    catalog.categories.map((category) => {
      const roadmap = catalog.roadmaps.find(
        (candidate) => candidate.categoryId === category.id,
      );
      const items =
        roadmap?.steps.flatMap((step) => {
          const stepDetail = stepDetailsById.get(step.id);

          return (
            stepDetail?.tasks.flatMap((task): ChecklistQueryItemModel[] => {
              const catalogItemId = Number(task.id);

              if (!selectedCatalogItemIds.has(catalogItemId)) {
                return [];
              }

              return [
                {
                  appointments: [],
                  categoryId: category.id,
                  checklistItemId: null,
                  isDone: false,
                  sourceCatalogItemId: catalogItemId,
                  title: task.title,
                },
              ];
            }) ?? []
          );
        }) ?? [];

      return [category.id, items] as const;
    }),
  );
}

function toAuthenticatedItem(item: MyChecklistItemModel) {
  return {
    appointments: item.appointments.map((appointment) => ({ ...appointment })),
    categoryId: String(item.categoryId),
    checklistItemId: item.id,
    isDone: item.isDone,
    sourceCatalogItemId: item.sourceCatalogItemId,
    title: item.title,
  } satisfies ChecklistQueryItemModel;
}

function assembleGuestChecklist(
  catalog: CatalogModel,
  catalogItemIds: number[],
): ChecklistQueryModel {
  const itemsByCategory = getCatalogItemsByCategory(
    catalog,
    new Set(catalogItemIds),
  );

  return {
    categories: catalog.categories.map((category) => ({
      id: category.id,
      items: itemsByCategory.get(category.id) ?? [],
      title: category.label,
    })),
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

  return {
    categories: catalog.categories.map((category) => ({
      id: category.id,
      items: checklistItems
        .filter((item) => String(item.categoryId) === category.id)
        .map(toAuthenticatedItem),
      title: category.label,
    })),
  };
}

export function createChecklistQueryRepository(
  catalogRepository: CatalogRepository,
  localChecklistDataSource: LocalChecklistDataSource,
  myChecklistQueryRepository: MyChecklistQueryRepository,
): ChecklistQueryRepository {
  return {
    async getChecklist(audience, signal) {
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
    },
  };
}
