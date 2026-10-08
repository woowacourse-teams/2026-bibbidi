import { RoadmapWorkspace } from "./RoadmapWorkspace";
import { AllPreparationStepsFeature } from "./AllPreparationStepsFeature";

export function PreparationRoadmapFeature({
  initialCategoryId,
}: {
  initialCategoryId?: string | null;
} = {}) {
  return (
    <RoadmapWorkspace
      initialCategoryId={initialCategoryId}
      renderAllSteps={(categoryId, onCategorySelect, viewSwitcher) => (
        <AllPreparationStepsFeature
          initialCategoryId={categoryId}
          onCategoryChange={onCategorySelect}
          viewSwitcher={viewSwitcher}
        />
      )}
    />
  );
}
