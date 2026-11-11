import type { CatalogModel } from "../../catalog";
import type { RoadmapPersonalState } from "../model/roadmapPersonalState";
import { getAvailablePreparationCategories } from "../model/roadmapSelection";

export interface PreparationCategoryViewModel {
  id: string;
  label: string;
}
export interface PreparationRoadmapViewModel {
  categories: PreparationCategoryViewModel[];
  categoryTitle?: string;
  stages: RoadmapStage[];
  summary: string;
  progressStatus: RoadmapPersonalState["status"];
}
export interface RoadmapTask {
  id: string;
  title: string;
  isEssential: boolean;
  isIncluded?: boolean;
  isComplete?: boolean;
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
  includedCount?: number;
  completedCount?: number;
}

/** Catalog order is stable even when a stage has no selected tasks. */
export function createPreparationRoadmapViewModel(
  catalog: CatalogModel,
  categoryId: string,
  personal: RoadmapPersonalState,
): PreparationRoadmapViewModel {
  const progressStatus = personal.status;
  const ready = progressStatus === "ready";
  const isGuest = ready && personal.audience === "guest";
  const guestIds = new Set(isGuest ? personal.catalogItemIds : []);
  const saved = new Map(
    ready && personal.audience === "authenticated"
      ? personal.items.flatMap((item) =>
          item.sourceCatalogItemId === null
            ? []
            : [[String(item.sourceCatalogItemId), item] as const],
        )
      : [],
  );
  const statusLabel =
    progressStatus === "error" ? "현황 확인 필요" : "현황 확인 중";
  const stages: RoadmapStage[] = [
    ...(catalog.roadmaps.find((item) => item.categoryId === categoryId)
      ?.steps ?? []),
  ]
    .sort((a, b) => a.order - b.order)
    .map((step) => {
      const detail = catalog.stepDetails.find(
        (item) => item.stepId === step.id,
      );
      const tasks: RoadmapTask[] = (detail?.tasks ?? []).map((task) => {
        const item = saved.get(task.id);
        return {
          id: task.id,
          title: item?.title ?? task.title,
          isEssential: task.essential ?? false,
          isIncluded: ready
            ? guestIds.has(task.id) || item !== undefined
            : undefined,
          isComplete: ready && !isGuest ? item?.status === "done" : undefined,
        };
      });
      const includedCount = ready
        ? tasks.filter((task) => task.isIncluded).length
        : undefined;
      const completedCount =
        ready && !isGuest
          ? tasks.filter((task) => task.isComplete).length
          : undefined;
      const isComplete =
        includedCount !== undefined &&
        includedCount > 0 &&
        includedCount === completedCount;
      const nextTask =
        tasks.find((task) => task.isIncluded && !task.isComplete) ??
        tasks.find((task) => task.isIncluded === false) ??
        tasks[0];
      return {
        id: step.id,
        order: step.order,
        isComplete,
        statusLabel: !ready
          ? statusLabel
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
          includedCount && completedCount !== undefined
            ? completedCount / includedCount
            : undefined,
        progressLabel: ready
          ? `내 할 일 ${includedCount}개${isGuest ? "" : ` · 완료 ${completedCount}개`}`
          : progressStatus === "error"
            ? "내 준비 현황을 확인해 주세요."
            : "내 준비 현황을 확인하고 있어요.",
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
  const taskCount = stages.reduce(
    (sum, stage) => sum + (stage.includedCount ?? 0),
    0,
  );
  const completedCount = stages.reduce(
    (sum, stage) => sum + (stage.completedCount ?? 0),
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
    summary: `${stages.length}개 단계 · ${ready ? `내 할 일 ${taskCount}개${isGuest ? "" : ` · 완료 ${completedCount}개`}` : `준비 ${statusLabel}`}`,
  };
}
