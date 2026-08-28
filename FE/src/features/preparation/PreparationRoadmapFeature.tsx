import { preparationRoadmapData } from "./model/preparationRoadmap.data";
import { createPreparationRoadmapViewModel } from "./view-model/createPreparationRoadmapViewModel";
import { PreparationRoadmap } from "./view/PreparationRoadmap";

const viewModel = createPreparationRoadmapViewModel(preparationRoadmapData);

export function PreparationRoadmapFeature() {
  return <PreparationRoadmap viewModel={viewModel} />;
}
