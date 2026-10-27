import type {
  CatalogItemModel,
  CatalogModel,
  CatalogRoadmapModel,
} from "../../catalog/model/catalog";

export type PreparationAudience = "authenticated" | "guest";

export interface PreparationDetailTaskModel extends CatalogItemModel {
  included: boolean;
}

export interface PreparationStepDetailModel {
  description: string;
  stepId: string;
  tasks: PreparationDetailTaskModel[];
}

export type PreparationRoadmapModel = CatalogRoadmapModel;

export interface PreparationCatalogModel extends Omit<
  CatalogModel,
  "stepDetails"
> {
  stepDetails: PreparationStepDetailModel[];
}

export function createPreparationCatalogModel(
  catalog: CatalogModel,
): PreparationCatalogModel {
  return {
    ...catalog,
    stepDetails: catalog.stepDetails.map((stepDetail) => ({
      ...stepDetail,
      tasks: stepDetail.tasks.map((task) => ({ ...task, included: false })),
    })),
  };
}

export function applyChecklistCatalogItemIds(
  catalog: PreparationCatalogModel,
  catalogItemIds: readonly string[],
): PreparationCatalogModel {
  const includedCatalogItemIds = new Set(catalogItemIds);

  return {
    ...catalog,
    stepDetails: catalog.stepDetails.map((stepDetail) => ({
      ...stepDetail,
      tasks: stepDetail.tasks.map((task) => ({
        ...task,
        included: includedCatalogItemIds.has(task.id),
      })),
    })),
  };
}

export function includeChecklistCatalogItemIds(
  catalog: PreparationCatalogModel,
  catalogItemIds: readonly string[],
): PreparationCatalogModel {
  const addedCatalogItemIds = new Set(catalogItemIds);

  return {
    ...catalog,
    stepDetails: catalog.stepDetails.map((stepDetail) => ({
      ...stepDetail,
      tasks: stepDetail.tasks.map((task) =>
        task.included || !addedCatalogItemIds.has(task.id)
          ? task
          : { ...task, included: true },
      ),
    })),
  };
}
