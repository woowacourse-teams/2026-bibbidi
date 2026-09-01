import { useEffect, useRef, useState } from "react";
import { analytics } from "../../infrastructure/analytics";
import {
  createPreparationCatalogViewEvent,
  createPreparationCategorySelectEvent,
  createPreparationStepSelectEvent,
} from "./analytics/preparationAnalytics";
import { preparationRoadmapData } from "./model/preparationRoadmap.data";
import {
  createInitialPreparationRoadmapSelection,
  createPreparationRoadmapViewModel,
  selectPreparationCategory,
} from "./view-model/createPreparationRoadmapViewModel";
import { PreparationRoadmap } from "./view/PreparationRoadmap";

export function PreparationRoadmapFeature() {
  const [selection, setSelection] = useState(() =>
    createInitialPreparationRoadmapSelection(preparationRoadmapData),
  );
  const [mobileExpandedStepId, setMobileExpandedStepId] = useState<
    string | null
  >(null);
  const hasTrackedCatalogViewRef = useRef(false);
  const viewModel = createPreparationRoadmapViewModel(
    preparationRoadmapData,
    selection.categoryId,
    selection.stepId,
  );

  useEffect(() => {
    if (hasTrackedCatalogViewRef.current) {
      return;
    }

    hasTrackedCatalogViewRef.current = true;
    analytics.track(createPreparationCatalogViewEvent(selection.categoryId));
  }, [selection.categoryId]);

  const handleCategorySelect = (categoryId: string) => {
    const nextSelection = selectPreparationCategory(
      preparationRoadmapData,
      selection,
      categoryId,
    );

    if (nextSelection === selection) {
      return;
    }

    analytics.track(
      createPreparationCategorySelectEvent({
        categoryId: nextSelection.categoryId,
        previousCategoryId: selection.categoryId,
      }),
    );
    setMobileExpandedStepId(null);
    setSelection(nextSelection);
  };

  const handleStepSelect = (
    stepId: string,
    options: { expandsMobileDetail: boolean },
  ) => {
    if (!options.expandsMobileDetail && selection.stepId === stepId) {
      return;
    }

    const selectedStep = viewModel.steps.find((step) => step.id === stepId);

    if (!selectedStep) {
      return;
    }

    analytics.track(
      createPreparationStepSelectEvent({
        categoryId: selection.categoryId,
        stepId,
        stepOrder: selectedStep.order,
      }),
    );
    setMobileExpandedStepId(options.expandsMobileDetail ? stepId : null);
    setSelection({
      ...selection,
      stepId,
    });
  };

  return (
    <PreparationRoadmap
      onCategorySelect={handleCategorySelect}
      onStepSelect={handleStepSelect}
      mobileExpandedStepId={mobileExpandedStepId}
      viewModel={viewModel}
    />
  );
}
