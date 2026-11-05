import { ReactNode } from "react";

import { GuestPersonalRoadmapViewModel } from "../view-model/createGuestPersonalRoadmapViewModel";
import { PreparationCategoryViewModel } from "../view-model/createPreparationRoadmapViewModel";
import { PersonalRoadmapLayout } from "./PersonalRoadmapLayout";
import { PersonalRoadmapCardFrame } from "./PersonalRoadmapCardFrame";

export function GuestPersonalRoadmap({
  roadmap,
  categories,
  onCategorySelect,
  onShowAll,
  viewSwitcher,
}: {
  roadmap: GuestPersonalRoadmapViewModel;
  categories: readonly PreparationCategoryViewModel[];
  onCategorySelect: (id: string) => void;
  onShowAll: () => void;
  viewSwitcher: ReactNode;
}) {
  const category = categories.find((item) => item.isCurrent);
  const { groups, stepCount, totalCount } = roadmap;

  return (
    <PersonalRoadmapLayout
      categories={categories}
      selectedCategoryId={category?.id}
      title={`${category?.label ?? "준비"} 로드맵`}
      summary={`${stepCount}개 단계 · 내 할 일 ${totalCount}개`}
      onCategorySelect={onCategorySelect}
      onShowAll={onShowAll}
      viewSwitcher={viewSwitcher}
      cards={groups.map((group) => ({
        id: group.id,
        content: (
          <PersonalRoadmapCardFrame
            id={group.id}
            title={group.title}
            numberLabel={group.numberLabel}
            summary={`내 할 일 ${group.tasks.length}개`}
          >
            {group.tasks.map((task) => (
              <li className="personal-roadmap__task" key={task.id}>
                <span className="personal-roadmap__task-title personal-roadmap__guest-task">
                  {task.title}
                </span>
              </li>
            ))}
          </PersonalRoadmapCardFrame>
        ),
      }))}
    />
  );
}
