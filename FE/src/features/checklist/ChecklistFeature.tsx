import { checklistCategoriesMock } from "./model/checklist.mock";
import { createChecklistViewModel } from "./view-model/createChecklistViewModel";
import { Checklist } from "./view/Checklist";

const checklistViewModel = createChecklistViewModel(checklistCategoriesMock);

export function ChecklistFeature() {
  return <Checklist categories={checklistViewModel} />;
}
