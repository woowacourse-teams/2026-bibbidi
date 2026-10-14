import { ReactNode } from "react";
import { PersonalRoadmapCategoryViewModel } from "../view-model/createPersonalRoadmapViewModel";
import { PersonalRoadmapCard } from "./PersonalRoadmapCard";
import { PersonalRoadmapLayout } from "./PersonalRoadmapLayout";

export function PersonalRoadmap({
  categories,
  categoryId,
  onCategorySelect,
  onShowAll,
  viewSwitcher,
  onTaskSelect,
  onTaskComplete,
  isChangingStatus,
}: {
  categories: PersonalRoadmapCategoryViewModel[];
  categoryId?: string | null;
  onCategorySelect: (id: string) => void;
  onShowAll: () => void;
  viewSwitcher: ReactNode;
  onTaskSelect: (taskId: string) => void;
  onTaskComplete: (taskId: string, checked: boolean) => void;
  isChangingStatus: boolean;
}) {
  const category =
    categories.find((item) => item.id === categoryId) ?? categories[0];

  return (
    <PersonalRoadmapLayout
      categories={categories.map((item) => ({
        id: item.id,
        label: item.title,
      }))}
      selectedCategoryId={category?.id}
      title={`${category?.title ?? "준비"} 로드맵`}
      summary={`${category?.stepCount ?? 0}개 단계 · 내 할 일 ${category?.totalCount ?? 0}개 · 완료 ${category?.completedCount ?? 0}개`}
      onCategorySelect={onCategorySelect}
      onShowAll={onShowAll}
      viewSwitcher={viewSwitcher}
      cards={(category?.groups ?? []).map((group) => ({
        id: group.id,
        content: (
          <PersonalRoadmapCard
            group={group}
            onTaskSelect={onTaskSelect}
            onTaskComplete={onTaskComplete}
            isChangingStatus={isChangingStatus}
          />
        ),
      }))}
    />
  );
}
