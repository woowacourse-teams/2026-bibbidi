import { RoadmapWorkspace } from "./RoadmapWorkspace";
import { AllPreparationStepsFeature } from "./AllPreparationStepsFeature";
import { GuestPersonalRoadmap } from "./view/GuestPersonalRoadmap";
import { createGuestPersonalRoadmapViewModel } from "./view-model/createGuestPersonalRoadmapViewModel";

export function PreparationRoadmapFeature({
  initialCategoryId,
}: {
  initialCategoryId?: string | null;
} = {}) {
  return (
    <RoadmapWorkspace
      initialCategoryId={initialCategoryId}
      renderCatalogRoadmap={({
        categoryId,
        onCategorySelect,
        viewSwitcher,
        view,
        onShowAll,
      }) => (
        <AllPreparationStepsFeature
          initialCategoryId={categoryId}
          onCategoryChange={onCategorySelect}
          viewSwitcher={viewSwitcher}
          renderRoadmap={
            view === "personal"
              ? ({ catalog, categories, onCategorySelect }) => (
                  <GuestPersonalRoadmap
                    categories={categories}
                    onCategorySelect={onCategorySelect}
                    roadmap={createGuestPersonalRoadmapViewModel(
                      catalog,
                      categories.find((category) => category.isCurrent)?.id,
                    )}
                    viewSwitcher={viewSwitcher}
                    onShowAll={onShowAll}
                  />
                )
              : undefined
          }
        />
      )}
    />
  );
}
