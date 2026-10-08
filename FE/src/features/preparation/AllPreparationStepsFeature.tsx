import { ReactNode, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth";
import { analytics } from "../../infrastructure/analytics";
import {
  createPreparationCatalogViewEvent,
  createPreparationCategorySelectEvent,
  createPreparationItemAddEvent,
  createPreparationStepSelectEvent,
} from "./analytics/preparationAnalytics";
import {
  applyChecklistCatalogItemIds,
  includeChecklistCatalogItemIds,
  PreparationAudience,
  PreparationCatalogModel,
} from "./model/preparationRoadmap";
import {
  preparationCatalogRepository,
  usePreparationChecklistRepository,
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
import { RoadmapSectionHeader } from "./view/RoadmapSectionHeader";
import { AllPreparationStepsSummaryFeature } from "./AllPreparationStepsSummaryFeature";

type CatalogRequestState = { owner: string | undefined } & (
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
    }
);

export function AllPreparationStepsFeature({
  initialCategoryId,
  onCategoryChange,
  viewSwitcher,
}: {
  initialCategoryId?: string | null;
  viewSwitcher?: ReactNode;
  onCategoryChange?: (categoryId: string) => void;
} = {}) {
  const { authState, refreshAuth } = useAuth();
  const checklistRepository = usePreparationChecklistRepository();
  const [additionErrorMessage, setAdditionErrorMessage] = useState<
    string | null
  >(null);
  const [addingCatalogItemIds, setAddingCatalogItemIds] = useState<string[]>(
    [],
  );
  const [requestState, setRequestState] = useState<CatalogRequestState>({
    owner: undefined,
    status: "loading",
  });
  const [requestRevision, setRequestRevision] = useState(0);
  const [requestedInitialCategoryId] = useState(initialCategoryId);
  const additionControllerRef = useRef<AbortController | null>(null);
  const hasTrackedCatalogViewRef = useRef(false);
  const audience: PreparationAudience | undefined =
    authState.status === "authenticated"
      ? "authenticated"
      : authState.status === "guest"
        ? "guest"
        : undefined;
  const owner =
    authState.status === "authenticated"
      ? `authenticated:${authState.user.id}`
      : audience;

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
        setAddingCatalogItemIds([]);

        if (!hasSelectablePreparationSteps(nextCatalog)) {
          setRequestState({ audience, owner, status: "empty" });
          return;
        }

        const initialSelection =
          createInitialPreparationRoadmapSelection(nextCatalog);
        const selection = requestedInitialCategoryId
          ? selectPreparationCategory(
              nextCatalog,
              initialSelection,
              requestedInitialCategoryId,
            )
          : initialSelection;

        setRequestState({
          audience,
          owner,
          catalog: nextCatalog,
          selection,
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
            owner,
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
  }, [
    audience,
    owner,
    checklistRepository,
    refreshAuth,
    requestRevision,
    requestedInitialCategoryId,
  ]);

  useEffect(
    () => () => {
      additionControllerRef.current?.abort();
      additionControllerRef.current = null;
    },
    [audience, owner],
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

    setRequestState({ audience, owner, status: "loading" });
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

  if (requestState.audience !== audience || requestState.owner !== owner) {
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
    onCategoryChange?.(nextSelection.categoryId);
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
    const additionContext = {
      categoryId: selection.categoryId,
      stepId: selection.stepId,
      stepOrder: viewModel.steps.find((step) => step.id === selection.stepId)
        ?.order,
    };

    if (additionContext.stepOrder === undefined) {
      return;
    }

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
          currentState.audience !== audience ||
          currentState.owner !== owner
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

      if (addedCatalogItemIds.length > 0) {
        analytics.track(
          createPreparationItemAddEvent({
            ...additionContext,
            itemCount: addedCatalogItemIds.length,
            stepOrder: additionContext.stepOrder,
          }),
        );
      }
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
      header={
        <RoadmapSectionHeader
          id="preparation-roadmap-title"
          title={`${viewModel.categories.find((category) => category.isCurrent)?.label ?? "준비"} · 전체 단계`}
          summary={
            <AllPreparationStepsSummaryFeature
              categoryId={selection.categoryId}
              stepCount={viewModel.steps.length}
              guestTaskCount={
                catalog.stepDetails
                  .filter((detail) =>
                    viewModel.steps.some((step) => step.id === detail.stepId),
                  )
                  .flatMap((detail) => detail.tasks)
                  .filter((task) => task.included).length
              }
            />
          }
          viewSwitcher={viewSwitcher}
        />
      }
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
