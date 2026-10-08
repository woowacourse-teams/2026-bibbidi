import { ChecklistQueryModel } from "../../checklist/model/checklistQuery";
import { createChecklistViewModel } from "../../checklist/view-model/createChecklistViewModel";

export interface PersonalRoadmapTaskViewModel {
  id: string;
  title: string;
  schedule: string;
  isComplete: boolean;
  statusLabel: string;
}

export interface PersonalRoadmapGroupViewModel {
  id: string;
  title: string;
  numberLabel: string;
  totalCount: number;
  completedCount: number;
  isCurrent: boolean;
  tasks: PersonalRoadmapTaskViewModel[];
}

export interface PersonalRoadmapCategoryViewModel {
  id: string;
  title: string;
  stepCount: number;
  totalCount: number;
  completedCount: number;
  groups: PersonalRoadmapGroupViewModel[];
}

export function createPersonalRoadmapViewModel(
  checklist: ChecklistQueryModel,
): PersonalRoadmapCategoryViewModel[] {
  return createChecklistViewModel(checklist).map((category, index) => {
    const currentGroup =
      category.groups.find(
        (group) => group.completedCount < group.totalCount,
      ) ?? category.groups[0];

    return {
      id: category.id,
      title: category.title,
      stepCount: checklist.categories[index].steps?.length ?? 0,
      totalCount: category.totalCount,
      completedCount: category.completedCount,
      groups: category.groups.map((group) => ({
        id: group.id,
        title: group.title,
        numberLabel: group.numberLabel,
        totalCount: group.totalCount,
        completedCount: group.completedCount,
        isCurrent: group.id === currentGroup?.id,
        tasks: group.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          schedule: task.schedule,
          isComplete: task.status === "complete",
          statusLabel: task.statusLabel,
        })),
      })),
    };
  });
}
