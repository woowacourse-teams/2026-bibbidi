import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth";
import { analytics } from "../../infrastructure/analytics";
import {
  createPreparationCatalogViewEvent,
  createPreparationCategorySelectEvent,
  createPreparationStepSelectEvent,
} from "./analytics/preparationAnalytics";
import {
  applyChecklistCatalogItemIds,
  PreparationAudience,
  PreparationCatalogModel,
} from "./model/preparationRoadmap";
import {
  checklistRepository,
  preparationCatalogRepository,
} from "./preparationDependencies";
import { PreparationAuthenticationRequiredError } from "./repository/preparationErrors";
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
  | { audience?: PreparationAudience; status: "loading" }
  | { audience: PreparationAudience; status: "empty" }
  | {
      audience: PreparationAudience;
      status: "authentication-required";
    }
  | { audience: PreparationAudience; status: "error" }
  | {
      audience: PreparationAudience;
      catalog: PreparationCatalogModel;
      selection: PreparationRoadmapSelection;
      status: "success";
    };

export function PreparationRoadmapFeature() {
  const { authState, refreshAuth } = useAuth();
  const [additionErrorMessage, setAdditionErrorMessage] = useState<
    string | null
  >(null);
  const [requestState, setRequestState] = useState<CatalogRequestState>({
    status: "loading",
  });
  const [requestRevision, setRequestRevision] = useState(0);
  const hasTrackedCatalogViewRef = useRef(false);
  const audience: PreparationAudience | undefined =
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

    void Promise.all([
      preparationCatalogRepository.getCatalog(audience, controller.signal),
      checklistRepository.getCatalogItemIds(audience, controller.signal),
    ])
      .then(([catalog, catalogItemIds]) => {
        if (ignoresResult) {
          return;
        }

        const nextCatalog = applyChecklistCatalogItemIds(
          catalog,
          catalogItemIds,
        );

        setAdditionErrorMessage(null);

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
    setAdditionErrorMessage(null);
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
    setAdditionErrorMessage(null);
    setRequestState({
      ...requestState,
      selection: {
        ...selection,
        stepId,
      },
    });
  };

  const addTasksToLocalChecklist = (catalogItemIds: string[]) => {
    if (audience !== "guest") {
      return;
    }

    try {
      const nextCatalogItemIds =
        checklistRepository.addLocalCatalogItemIds(catalogItemIds);

      setAdditionErrorMessage(null);
      setRequestState({
        ...requestState,
        catalog: applyChecklistCatalogItemIds(catalog, nextCatalogItemIds),
      });
    } catch {
      setAdditionErrorMessage("할 일을 저장하지 못했어요. 다시 시도해 주세요.");
    }
  };

  const handleTaskAdd = (catalogItemId: string) => {
    addTasksToLocalChecklist([catalogItemId]);
  };

  const handleAddAllTasks = () => {
    addTasksToLocalChecklist(
      viewModel.selectedStepDetail.detailTasks.map((task) => task.id),
    );
  };

  return (
    <PreparationRoadmap
      additionErrorMessage={additionErrorMessage}
      canAddTasks={audience === "guest"}
      onAddAllTasks={handleAddAllTasks}
      onCategorySelect={handleCategorySelect}
      onStepSelect={handleStepSelect}
      onTaskAdd={handleTaskAdd}
      viewModel={viewModel}
    />
  );
}
