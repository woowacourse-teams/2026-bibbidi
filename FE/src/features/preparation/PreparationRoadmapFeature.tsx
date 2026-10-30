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
      renderCatalogRoadmap={({ categoryId, onCategorySelect }) => (
        <AllPreparationStepsFeature
          initialCategoryId={categoryId}
          onCategoryChange={onCategorySelect}
        />
      )}
    />
  );
}
