import { useEffect, useRef, useState } from "react";
import { analytics } from "../../infrastructure/analytics";
import {
  createPreparationCatalogViewEvent,
  createPreparationCategorySelectEvent,
  createPreparationStepSelectEvent,
} from "./analytics/preparationAnalytics";
import { preparationRoadmapData } from "./model/preparationRoadmap.data";
import { PreparationCategoryNavigationDirection } from "./model/preparationRoadmap";
import {
  createInitialPreparationRoadmapSelection,
  createPreparationRoadmapViewModel,
  selectAdjacentPreparationCategory,
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
        direction: "direct",
        inputMethod: "button",
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

  const handleCategoryNavigate = (
    direction: PreparationCategoryNavigationDirection,
  ) => {
    const nextSelection = selectAdjacentPreparationCategory(
      preparationRoadmapData,
      selection,
      direction,
    );

    if (nextSelection === selection) {
      return;
    }

    analytics.track(
      createPreparationCategorySelectEvent({
        categoryId: nextSelection.categoryId,
        direction,
        inputMethod: "wheel",
        previousCategoryId: selection.categoryId,
      }),
    );
    setMobileExpandedStepId(null);
    setSelection(nextSelection);
  };

  return (
    <PreparationRoadmap
      onCategoryNavigate={handleCategoryNavigate}
      onCategorySelect={handleCategorySelect}
      onStepSelect={handleStepSelect}
      mobileExpandedStepId={mobileExpandedStepId}
      viewModel={viewModel}
    />
  );
}
