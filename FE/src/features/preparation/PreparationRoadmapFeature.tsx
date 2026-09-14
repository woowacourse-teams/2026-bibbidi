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
  includeChecklistCatalogItemIds,
  PreparationAudience,
  PreparationCatalogModel,
} from "./model/preparationRoadmap";
import {
  checklistRepository,
  preparationCatalogRepository,
} from "./preparationDependencies";
import {
  PreparationAuthenticationRequiredError,
  PreparationChecklistAdditionError,
} from "./repository/preparationErrors";
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
  const [addingCatalogItemIds, setAddingCatalogItemIds] = useState<string[]>(
    [],
  );
  const [requestState, setRequestState] = useState<CatalogRequestState>({
    status: "loading",
  });
  const [requestRevision, setRequestRevision] = useState(0);
  const additionControllerRef = useRef<AbortController | null>(null);
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
      preparationCatalogRepository.getCatalog(controller.signal),
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

  useEffect(
    () => () => {
      additionControllerRef.current?.abort();
    },
    [audience],
  );

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

  const addTasksToChecklist = async (catalogItemIds: string[]) => {
    if (catalogItemIds.length === 0 || additionControllerRef.current) {
      return;
    }

    const controller = new AbortController();
    additionControllerRef.current = controller;
    setAddingCatalogItemIds(catalogItemIds);
    setAdditionErrorMessage(null);

    try {
      const addedCatalogItemIds = await checklistRepository.addCatalogItemIds(
        audience,
        catalogItemIds,
        controller.signal,
      );

      if (controller.signal.aborted) {
        return;
      }

      setRequestState((currentState) => {
        if (
          currentState.status !== "success" ||
          currentState.audience !== audience
        ) {
          return currentState;
        }

        return {
          ...currentState,
          catalog: includeChecklistCatalogItemIds(
            currentState.catalog,
            addedCatalogItemIds,
          ),
        };
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      if (error instanceof PreparationAuthenticationRequiredError) {
        setAdditionErrorMessage(
          "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.",
        );
        refreshAuth();
        return;
      }

      setAdditionErrorMessage(
        error instanceof PreparationChecklistAdditionError
          ? error.message
          : "할 일을 저장하지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      if (additionControllerRef.current === controller) {
        additionControllerRef.current = null;
        setAddingCatalogItemIds([]);
      }
    }
  };

  const handleTaskAdd = (catalogItemId: string) => {
    void addTasksToChecklist([catalogItemId]);
  };

  const handleAddAllTasks = () => {
    void addTasksToChecklist(
      viewModel.selectedStepDetail.detailTasks.map((task) => task.id),
    );
  };

  return (
    <PreparationRoadmap
      additionErrorMessage={additionErrorMessage}
      addingCatalogItemIds={addingCatalogItemIds}
      canAddTasks
      onAddAllTasks={handleAddAllTasks}
      onCategorySelect={handleCategorySelect}
      onStepSelect={handleStepSelect}
      onTaskAdd={handleTaskAdd}
      viewModel={viewModel}
    />
  );
}
