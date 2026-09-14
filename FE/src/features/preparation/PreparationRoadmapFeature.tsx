import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth";
import { analytics } from "../../infrastructure/analytics";
import {
  createPreparationCatalogViewEvent,
  createPreparationCategorySelectEvent,
  createPreparationStepSelectEvent,
} from "./analytics/preparationAnalytics";
import { PreparationCatalogModel } from "./model/preparationRoadmap";
import {
  PreparationCatalogAudience,
  PreparationAuthenticationRequiredError,
  preparationCatalogRepository,
} from "./repository/preparationCatalogRepository";
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
  | { audience?: PreparationCatalogAudience; status: "loading" }
  | { audience: PreparationCatalogAudience; status: "empty" }
  | {
      audience: PreparationCatalogAudience;
      status: "authentication-required";
    }
  | { audience: PreparationCatalogAudience; status: "error" }
  | {
      audience: PreparationCatalogAudience;
      catalog: PreparationCatalogModel;
      selection: PreparationRoadmapSelection;
      status: "success";
    };

export function PreparationRoadmapFeature() {
  const { authState, refreshAuth } = useAuth();
  const [requestState, setRequestState] = useState<CatalogRequestState>({
    status: "loading",
  });
  const [requestRevision, setRequestRevision] = useState(0);
  const hasTrackedCatalogViewRef = useRef(false);
  const audience: PreparationCatalogAudience | undefined =
    authState.status === "authenticated"
      ? "authenticated"
      : authState.status === "guest"
        ? "guest"
        : undefined;

  useEffect(() => {
    if (!audience) {
      return;
    }

    const controller = new AbortController();
    let ignoresResult = false;

    void preparationCatalogRepository
      .getCatalog(audience, controller.signal)
      .then((nextCatalog) => {
        if (ignoresResult) {
          return;
        }

        if (!hasSelectablePreparationSteps(nextCatalog)) {
          setRequestState({ audience, status: "empty" });
          return;
        }

        setRequestState({
          audience,
          catalog: nextCatalog,
          selection: createInitialPreparationRoadmapSelection(nextCatalog),
          status: "success",
        });
      })
      .catch((error: unknown) => {
        if (!ignoresResult) {
          const requiresAuthentication =
            error instanceof PreparationAuthenticationRequiredError;

          if (requiresAuthentication) {
            refreshAuth();
          }

          setRequestState({
            audience,
            status: requiresAuthentication
              ? "authentication-required"
              : "error",
          });
        }
      });

    return () => {
      ignoresResult = true;
      controller.abort();
    };
  }, [audience, refreshAuth, requestRevision]);

  useEffect(() => {
    if (requestState.status !== "success" || hasTrackedCatalogViewRef.current) {
      return;
    }

    hasTrackedCatalogViewRef.current = true;
    analytics.track(
      createPreparationCatalogViewEvent(requestState.selection.categoryId),
    );
  }, [requestState]);

  const handleRetry = () => {
    if (!audience) {
      refreshAuth();
      return;
    }

    setRequestState({ audience, status: "loading" });
    setRequestRevision((value) => value + 1);
  };

  if (!audience) {
    return (
      <PreparationRoadmapState
        onRetry={
          requestState.status === "authentication-required"
            ? handleRetry
            : undefined
        }
        status={
          requestState.status === "authentication-required"
            ? "authentication-required"
            : "loading"
        }
      />
    );
  }

  if (requestState.audience !== audience) {
    return <PreparationRoadmapState status="loading" />;
  }

  if (
    requestState.status === "authentication-required" ||
    requestState.status === "error"
  ) {
    return (
      <PreparationRoadmapState
        onRetry={handleRetry}
        status={requestState.status}
      />
    );
  }

  if (requestState.status !== "success") {
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
