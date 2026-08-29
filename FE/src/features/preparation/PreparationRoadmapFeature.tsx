import { useState } from "react";
import { preparationRoadmapData } from "./model/preparationRoadmap.data";
import {
  createInitialPreparationRoadmapSelection,
  createPreparationRoadmapViewModel,
  PreparationCategoryNavigationDirection,
  selectAdjacentPreparationCategory,
  selectPreparationCategory,
} from "./view-model/createPreparationRoadmapViewModel";
import { PreparationRoadmap } from "./view/PreparationRoadmap";

export function PreparationRoadmapFeature() {
  const [selection, setSelection] = useState(() =>
    createInitialPreparationRoadmapSelection(preparationRoadmapData),
  );
  const viewModel = createPreparationRoadmapViewModel(
    preparationRoadmapData,
    selection.categoryId,
    selection.stepId,
  );

  const handleCategorySelect = (categoryId: string) => {
    setSelection((currentSelection) =>
      selectPreparationCategory(
        preparationRoadmapData,
        currentSelection,
        categoryId,
      ),
    );
  };

  const handleStepSelect = (stepId: string) => {
    setSelection((currentSelection) => ({
      ...currentSelection,
      stepId,
    }));
  };

  const handleCategoryNavigate = (
    direction: PreparationCategoryNavigationDirection,
  ) => {
    setSelection((currentSelection) =>
      selectAdjacentPreparationCategory(
        preparationRoadmapData,
        currentSelection,
        direction,
      ),
    );
  };

  return (
    <PreparationRoadmap
      onCategoryNavigate={handleCategoryNavigate}
      onCategorySelect={handleCategorySelect}
      onStepSelect={handleStepSelect}
      viewModel={viewModel}
    />
  );
}
