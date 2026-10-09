import { RoadmapWorkspace } from "./RoadmapWorkspace";
import { AllPreparationStepsFeature } from "./AllPreparationStepsFeature";
import { GuestPersonalRoadmap } from "./view/GuestPersonalRoadmap";

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
              ? (props) => (
                  <GuestPersonalRoadmap
                    {...props}
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
