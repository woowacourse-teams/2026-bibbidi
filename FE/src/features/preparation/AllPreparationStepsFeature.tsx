import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "../auth";
import type { CatalogModel } from "../catalog";
import { analytics } from "../../infrastructure/analytics";
import {
  createPreparationCatalogViewEvent,
  createPreparationCategorySelectEvent,
  createPreparationItemAddEvent,
  createPreparationStepSelectEvent,
} from "./analytics/preparationAnalytics";
import { usePreparationCatalog } from "./hooks/usePreparationCatalog";
import { useRoadmapChecklist } from "./hooks/useRoadmapChecklist";
import {
  createInitialPreparationRoadmapSelection,
  getAvailablePreparationCategories,
  hasSelectablePreparationSteps,
  selectPreparationCategory,
} from "./model/roadmapSelection";
import {
  PreparationAuthenticationRequiredError,
  PreparationChecklistAdditionError,
} from "./repository/preparationErrors";
import { PreparationRoadmap } from "./view/PreparationRoadmap";
import { PreparationRoadmapState } from "./view/PreparationRoadmapState";
import { createPreparationRoadmapViewModel } from "./view-model/createPreparationRoadmapViewModel";

interface AllPreparationStepsProps {
  initialCatalog?: CatalogModel;
  initialCategoryId?: string | null;
  onCategoryChange?: (categoryId: string) => void;
}

export function AllPreparationStepsFeature({
  initialCatalog,
  ...selectionProps
}: AllPreparationStepsProps = {}) {
  const { request, retry } = usePreparationCatalog(initialCatalog);
  const checklist = useRoadmapChecklist();

  if (request.status !== "success") {
    return <PreparationRoadmapState status={request.status} onRetry={retry} />;
  }

  if (!hasSelectablePreparationSteps(request.catalog)) {
    return <PreparationRoadmapState status="empty" />;
  }

  return (
    <PreparationCatalogRoadmap
      {...selectionProps}
      catalog={request.catalog}
      checklist={checklist}
    />
  );
}

function PreparationCatalogRoadmap({
  catalog,
  checklist: {
    checklistRepository,
    personal,
    recordGuestAdditions,
    retry,
    scope,
  },
  initialCategoryId,
  onCategoryChange,
}: Omit<AllPreparationStepsProps, "initialCatalog"> & {
  catalog: CatalogModel;
  checklist: ReturnType<typeof useRoadmapChecklist>;
}) {
  const { refreshAuth } = useAuth();
  const [storedSelection, setSelection] = useState(() =>
    createInitialPreparationRoadmapSelection(catalog),
  );
  const categories = getAvailablePreparationCategories(catalog);
  const baseSelection = categories.some(
    ({ id }) => id === storedSelection.categoryId,
  )
    ? storedSelection
    : createInitialPreparationRoadmapSelection(catalog);
  const selection =
    initialCategoryId && categories.some(({ id }) => id === initialCategoryId)
      ? selectPreparationCategory(catalog, baseSelection, initialCategoryId)
      : baseSelection;

  const [addition, setAddition] = useState<{
    scope: typeof scope;
    ids: readonly string[];
    error: string | null;
  } | null>(null);
  const activeAddition = addition?.scope === scope ? addition : null;
  if (addition && !activeAddition) setAddition(null);
  const additionControllerRef = useRef<AbortController | null>(null);
  const hasTrackedCatalogViewRef = useRef(false);
  const viewModel = createPreparationRoadmapViewModel(
    catalog,
    selection.categoryId,
    personal,
  );

  useLayoutEffect(
    () => () => {
      additionControllerRef.current?.abort();
      additionControllerRef.current = null;
    },
    [scope],
  );

  useEffect(() => {
    if (personal.status !== "ready" || hasTrackedCatalogViewRef.current) return;

    hasTrackedCatalogViewRef.current = true;
    analytics.track(createPreparationCatalogViewEvent(selection.categoryId));
  }, [personal.status, selection.categoryId]);

  const handleCategorySelect = (categoryId: string) => {
    const nextSelection = selectPreparationCategory(
      catalog,
      selection,
      categoryId,
    );
    if (nextSelection === selection) return;

    analytics.track(
      createPreparationCategorySelectEvent({
        categoryId: nextSelection.categoryId,
        previousCategoryId: selection.categoryId,
      }),
    );
    setAddition(null);
    onCategoryChange?.(nextSelection.categoryId);
    setSelection(nextSelection);
  };

  const handleStepSelect = (stepId: string) => {
    const selectedStep = viewModel.stages.find((step) => step.id === stepId);
    if (!selectedStep) return;

    analytics.track(
      createPreparationStepSelectEvent({
        categoryId: selection.categoryId,
        stepId,
        stepOrder: selectedStep.order,
      }),
    );
    setAddition(null);
    setSelection({ ...selection, stepId });
  };

  const addTasksToChecklist = async (catalogItemIds: string[]) => {
    if (
      personal.status !== "ready" ||
      catalogItemIds.length === 0 ||
      additionControllerRef.current
    )
      return;

    const { audience } = personal;
    const stepOrder = viewModel.stages.find(
      (step) => step.id === selection.stepId,
    )?.order;
    if (stepOrder === undefined) return;

    const controller = new AbortController();
    additionControllerRef.current = controller;
    setAddition({ scope, ids: catalogItemIds, error: null });

    try {
      const addedCatalogItemIds = await checklistRepository.addCatalogItemIds(
        audience,
        catalogItemIds,
        controller.signal,
      );
      if (controller.signal.aborted || addedCatalogItemIds.length === 0) return;

      if (audience === "guest") recordGuestAdditions(addedCatalogItemIds);
      analytics.track(
        createPreparationItemAddEvent({
          ...selection,
          stepOrder,
          itemCount: addedCatalogItemIds.length,
        }),
      );
    } catch (error) {
      if (controller.signal.aborted) return;

      if (error instanceof PreparationAuthenticationRequiredError) {
        setAddition({
          scope,
          ids: [],
          error: "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.",
        });
        refreshAuth();
        return;
      }

      setAddition({
        scope,
        ids: [],
        error:
          error instanceof PreparationChecklistAdditionError
            ? error.message
            : "할 일을 저장하지 못했어요. 다시 시도해 주세요.",
      });
    } finally {
      if (additionControllerRef.current === controller) {
        additionControllerRef.current = null;
        setAddition((current) =>
          current?.scope === scope ? { ...current, ids: [] } : current,
        );
      }
    }
  };

  return (
    <PreparationRoadmap
      categoryId={selection.categoryId}
      viewModel={viewModel}
      selectedStepId={selection.stepId}
      personalScope={scope}
      isGuest={personal.status === "ready" && personal.audience === "guest"}
      onRetryProgress={retry}
      additionErrorMessage={activeAddition?.error ?? null}
      addingCatalogItemIds={activeAddition?.ids ?? []}
      onAddAllTasks={() =>
        void addTasksToChecklist(
          viewModel.stages
            .find((stage) => stage.id === selection.stepId)
            ?.tasks.filter((task) => task.isIncluded === false)
            .map((task) => task.id) ?? [],
        )
      }
      onCategorySelect={handleCategorySelect}
      onStepSelect={handleStepSelect}
      onTaskAdd={(id) => void addTasksToChecklist([id])}
    />
  );
}
