import { useState } from "react";
import { preparationRoadmapData } from "./model/preparationRoadmap.data";
import {
  createPreparationRoadmapViewModel,
  getInitialSelectedStepId,
} from "./view-model/createPreparationRoadmapViewModel";
import { PreparationRoadmap } from "./view/PreparationRoadmap";

export function PreparationRoadmapFeature() {
  const [selectedStepId, setSelectedStepId] = useState(() =>
    getInitialSelectedStepId(preparationRoadmapData),
  );
  const viewModel = createPreparationRoadmapViewModel(
    preparationRoadmapData,
    selectedStepId,
  );

  return (
    <PreparationRoadmap
      onStepSelect={setSelectedStepId}
      viewModel={viewModel}
    />
  );
}
