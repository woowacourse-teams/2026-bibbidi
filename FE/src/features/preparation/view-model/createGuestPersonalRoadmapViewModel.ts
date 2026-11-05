import { PreparationCatalogModel } from "../model/preparationRoadmap";

export interface GuestPersonalRoadmapViewModel {
  groups: {
    id: string;
    title: string;
    numberLabel: string;
    tasks: { id: string; title: string }[];
  }[];
  stepCount: number;
  totalCount: number;
}

export function createGuestPersonalRoadmapViewModel(
  catalog: PreparationCatalogModel,
  categoryId: string | undefined,
): GuestPersonalRoadmapViewModel {
  const steps =
    catalog.roadmaps.find((roadmap) => roadmap.categoryId === categoryId)
      ?.steps ?? [];
  const groups = [...steps]
    .sort((first, second) => first.order - second.order)
    .map((step) => ({
      id: step.id,
      title: step.title,
      numberLabel: String(step.order).padStart(2, "0"),
      tasks:
        catalog.stepDetails
          .find((detail) => detail.stepId === step.id)
          ?.tasks.filter((task) => task.included)
          .map((task) => ({ id: task.id, title: task.title })) ?? [],
    }))
    .filter((group) => group.tasks.length > 0);

  return {
    groups,
    stepCount: steps.length,
    totalCount: groups.reduce((count, group) => count + group.tasks.length, 0),
  };
}
