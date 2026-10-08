import { ChecklistQueryModel } from "../../checklist/model/checklistQuery";
import {
  ChecklistCategoryViewModel,
  createChecklistViewModel,
} from "../../checklist/view-model/createChecklistViewModel";

export interface PersonalRoadmapCategoryViewModel extends ChecklistCategoryViewModel {
  stepCount: number;
}

export function createPersonalRoadmapViewModel(
  checklist: ChecklistQueryModel,
): PersonalRoadmapCategoryViewModel[] {
  return createChecklistViewModel(checklist).map((category, index) => ({
    ...category,
    stepCount: checklist.categories[index].steps?.length ?? 0,
  }));
}
