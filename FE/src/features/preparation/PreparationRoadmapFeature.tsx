import type { CatalogModel } from "../catalog";
import { RoadmapWorkspace } from "./RoadmapWorkspace";
import { AllPreparationStepsFeature } from "./AllPreparationStepsFeature";

export function PreparationRoadmapFeature({
  initialCategoryId,
  initialCatalog,
}: {
  initialCategoryId?: string | null;
  initialCatalog?: CatalogModel;
} = {}) {
  return (
    <RoadmapWorkspace
      initialCategoryId={initialCategoryId}
      renderCatalogRoadmap={({ categoryId, onCategorySelect }) => (
        <AllPreparationStepsFeature
          initialCategoryId={categoryId}
          initialCatalog={initialCatalog}
          onCategoryChange={onCategorySelect}
        />
      )}
    />
  );
}
