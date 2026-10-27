import {
  getChecklistCategoryItems,
  type ChecklistQueryModel,
} from "../../checklist/model/checklistQuery";
import type { PreparationCatalogModel } from "../model/preparationRoadmap";

import { getAvailablePreparationCategories } from "../model/roadmapSelection";

export type RoadmapProgressStatus = "ready" | "loading" | "error";
export interface PreparationCategoryViewModel {
  id: string;
  label: string;
}
export interface PreparationRoadmapViewModel {
  categories: PreparationCategoryViewModel[];
  categoryTitle?: string;
  stages: RoadmapStage[];
  summary: string;
  progressStatus: RoadmapProgressStatus;
}
export interface RoadmapTask {
  id: string;
  title: string;
  isEssential: boolean;
  isIncluded: boolean;
  isComplete: boolean;
}

export interface RoadmapStage {
  id: string;
  title: string;
  order: number;
  isComplete: boolean;
  statusLabel: string;
  badgeColor: "positive" | "primary" | "dark";
  progress?: number;
  progressLabel: string;
  nextTask?: RoadmapTask;
  previewLabel?: string;
  numberLabel: string;
  iconUrl?: string;
  description: string;
  tasks: RoadmapTask[];
  includedCount: number;
  completedCount: number;
}

/** Catalog order is stable even when a stage has no selected tasks. */
export function createPreparationRoadmapViewModel(
  catalog: PreparationCatalogModel,
  categoryId: string,
  {
    checklist,
    isGuest,
    progressStatus,
  }: {
    checklist?: ChecklistQueryModel;
    isGuest: boolean;
    progressStatus: RoadmapProgressStatus;
  },
): PreparationRoadmapViewModel {
  const category = checklist?.categories.find((item) => item.id === categoryId);
  const saved = new Map(
    category
      ? getChecklistCategoryItems(category)
          .filter((item) => item.sourceCatalogItemId !== null)
          .map((item) => [String(item.sourceCatalogItemId), item])
      : [],
  );
  const stages: RoadmapStage[] = [
    ...(catalog.roadmaps.find((item) => item.categoryId === categoryId)
      ?.steps ?? []),
  ]
    .sort((a, b) => a.order - b.order)
    .map((step) => {
      const detail = catalog.stepDetails.find(
        (item) => item.stepId === step.id,
      );
      const tasks = (detail?.tasks ?? []).map((task) => {
        const item = saved.get(task.id);
        return {
          id: task.id,
          title: item?.title ?? task.title,
          isEssential: task.essential ?? false,
          isIncluded: task.included || item !== undefined,
          isComplete: item?.status === "done",
        };
      });
      const includedCount = tasks.filter((task) => task.isIncluded).length;
      const completedCount = tasks.filter(
        (task) => task.isIncluded && task.isComplete,
      ).length;
      const isComplete =
        !isGuest &&
        progressStatus === "ready" &&
        includedCount > 0 &&
        includedCount === completedCount;
      const nextTask =
        tasks.find((task) => task.isIncluded && !task.isComplete) ??
        tasks.find((task) => !task.isIncluded) ??
        tasks[0];
      return {
        id: step.id,
        order: step.order,
        isComplete,
        statusLabel:
          progressStatus === "loading"
            ? "현황 확인 중"
            : progressStatus === "error"
              ? "현황 확인 필요"
              : isComplete
                ? "내 할 일 완료"
                : includedCount
                  ? isGuest
                    ? "준비 중"
                    : "진행 중"
                  : "준비 전",
        badgeColor: isComplete
          ? "positive"
          : includedCount
            ? "primary"
            : "dark",
        progress:
          !isGuest && progressStatus === "ready" && includedCount > 0
            ? completedCount / includedCount
            : undefined,
        progressLabel:
          progressStatus === "ready"
            ? `내 할 일 ${includedCount}개${isGuest ? "" : ` · 완료 ${completedCount}개`}`
            : progressStatus === "loading"
              ? "내 준비 현황을 확인하고 있어요."
              : "내 준비 현황을 확인해 주세요.",
        nextTask,
        previewLabel: nextTask
          ? isComplete && nextTask.isComplete
            ? "완료한 할 일"
            : nextTask.isIncluded
              ? "다음 할 일"
              : "준비할 일"
          : undefined,
        title: step.title,
        numberLabel: String(step.order).padStart(2, "0"),
        iconUrl: step.iconUrl,
        description: detail?.description ?? "",
        tasks,
        includedCount,
        completedCount,
      };
    });
  const taskCount = stages.reduce((sum, stage) => sum + stage.includedCount, 0);
  const completedCount = stages.reduce(
    (sum, stage) => sum + stage.completedCount,
    0,
  );
  return {
    categories: getAvailablePreparationCategories(catalog).map(
      ({ id, label }) => ({ id, label }),
    ),
    categoryTitle: catalog.categories.find((item) => item.id === categoryId)
      ?.label,
    stages,
    progressStatus,
    summary: `${stages.length}개 단계 · ${progressStatus === "ready" ? `내 할 일 ${taskCount}개${isGuest ? "" : ` · 완료 ${completedCount}개`}` : progressStatus === "loading" ? "준비 현황 확인 중" : "준비 현황 확인 필요"}`,
  };
}
