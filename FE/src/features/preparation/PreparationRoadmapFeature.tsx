import { useEffect, useRef, useState } from "react";
import { analytics } from "../../infrastructure/analytics";
import {
  createPreparationCatalogViewEvent,
  createPreparationCategorySelectEvent,
  createPreparationStepSelectEvent,
} from "./analytics/preparationAnalytics";
import { getPublicPreparationCatalog } from "./api/getPublicPreparationCatalog";
import { PreparationCatalogModel } from "./model/preparationRoadmap";
import {
  createInitialPreparationRoadmapSelection,
  createPreparationRoadmapViewModel,
  hasSelectablePreparationSteps,
  PreparationRoadmapSelection,
  selectPreparationCategory,
} from "./view-model/createPreparationRoadmapViewModel";
import { PreparationRoadmap } from "./view/PreparationRoadmap";
import { PreparationRoadmapState } from "./view/PreparationRoadmapState";

type CatalogRequestState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | {
      catalog: PreparationCatalogModel;
      selection: PreparationRoadmapSelection;
      status: "success";
    };

export function PreparationRoadmapFeature() {
  const [requestState, setRequestState] = useState<CatalogRequestState>({
    status: "loading",
  });
  const [requestRevision, setRequestRevision] = useState(0);
  const hasTrackedCatalogViewRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let ignoresResult = false;

    void getPublicPreparationCatalog(controller.signal)
      .then((nextCatalog) => {
        if (ignoresResult) {
          return;
        }

        if (!hasSelectablePreparationSteps(nextCatalog)) {
          setRequestState({ status: "empty" });
          return;
        }

        setRequestState({
          catalog: nextCatalog,
          selection: createInitialPreparationRoadmapSelection(nextCatalog),
          status: "success",
        });
      })
      .catch(() => {
        if (!ignoresResult) {
          setRequestState({ status: "error" });
        }
      });

    return () => {
      ignoresResult = true;
      controller.abort();
    };
  }, [requestRevision]);

  useEffect(() => {
    if (requestState.status !== "success" || hasTrackedCatalogViewRef.current) {
      return;
    }

    hasTrackedCatalogViewRef.current = true;
    analytics.track(
      createPreparationCatalogViewEvent(requestState.selection.categoryId),
    );
  }, [requestState]);

  if (requestState.status === "error") {
    const handleRetry = () => {
      setRequestState({ status: "loading" });
      setRequestRevision((value) => value + 1);
    };

    return <PreparationRoadmapState onRetry={handleRetry} status="error" />;
  }

  if (requestState.status === "loading" || requestState.status === "empty") {
    return <PreparationRoadmapState status={requestState.status} />;
  }

  const { catalog, selection } = requestState;
  const viewModel = createPreparationRoadmapViewModel(
    catalog,
    selection.categoryId,
    selection.stepId,
  );

  const handleCategorySelect = (categoryId: string) => {
    const nextSelection = selectPreparationCategory(
      catalog,
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
    setRequestState({
      ...requestState,
      selection: nextSelection,
    });
  };

  const handleStepSelect = (stepId: string) => {
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
    setRequestState({
      ...requestState,
      selection: {
        ...selection,
        stepId,
      },
    });
  };

  return (
    <PreparationRoadmap
      onCategorySelect={handleCategorySelect}
      onStepSelect={handleStepSelect}
      viewModel={viewModel}
    />
  );
}
