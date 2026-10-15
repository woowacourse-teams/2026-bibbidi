import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ChecklistStatusConfirmationDialog } from "../checklist/view/ChecklistStatusConfirmationDialog";
import { useRoadmapChecklist } from "./hooks/useRoadmapChecklist";
import { useRoadmapTaskCompletion } from "./hooks/useRoadmapTaskCompletion";
import { createPersonalRoadmapViewModel } from "./view-model/createPersonalRoadmapViewModel";
import { PersonalRoadmap } from "./view/PersonalRoadmap";
import { PreparationRoadmapState } from "./view/PreparationRoadmapState";
import {
  getChecklistCategoryItems,
  type ChecklistQueryModel,
} from "../checklist/model/checklistQuery";

function findRevealTarget(
  checklist: ChecklistQueryModel,
  catalogItemId: number,
) {
  for (const category of checklist.categories) {
    const task = getChecklistCategoryItems(category).find(
      (item) => item.sourceCatalogItemId === catalogItemId,
    );
    if (task) return { categoryId: category.id, taskId: task.id };
  }
}

export function PersonalRoadmapFeature({
  categoryId,
  onCategorySelect,
  onShowAll,
  viewSwitcher,
  revealCatalogItemId,
  onRevealComplete,
}: {
  categoryId?: string | null;
  onCategorySelect: (id: string) => void;
  onShowAll: () => void;
  viewSwitcher: ReactNode;
  revealCatalogItemId?: number;
  onRevealComplete?: () => void;
}) {
  const { request, isRefreshing, retry } = useRoadmapChecklist();
  const navigate = useNavigate();
  const [refreshError, setRefreshError] = useState<string>();
  const completion = useRoadmapTaskCompletion(
    request.status === "success" ? request.checklist : null,
    setRefreshError,
  );
  const displayRequest = refreshError ? { status: "error" as const } : request;
  const confirmation = completion.statusConfirmation;
  const revealTarget =
    displayRequest.status === "success" && revealCatalogItemId !== undefined
      ? findRevealTarget(displayRequest.checklist, revealCatalogItemId)
      : undefined;
  const targetCategoryId = revealTarget?.categoryId;
  useEffect(() => {
    if (
      revealCatalogItemId === undefined ||
      (isRefreshing && displayRequest.status === "success")
    )
      return;
    if (displayRequest.status !== "success" || !targetCategoryId) {
      if (displayRequest.status !== "loading") onRevealComplete?.();
    } else if (targetCategoryId !== categoryId) {
      onCategorySelect(targetCategoryId);
    }
  }, [
    revealCatalogItemId,
    displayRequest.status,
    isRefreshing,
    targetCategoryId,
    categoryId,
    onCategorySelect,
    onRevealComplete,
  ]);
  if (displayRequest.status !== "success") {
    return (
      <>
        {viewSwitcher}
        <PreparationRoadmapState
          status={displayRequest.status}
          errorMessage={refreshError}
          onRetry={() => {
            completion.clearError();
            setRefreshError(undefined);
            retry();
          }}
        />
      </>
    );
  }
  return (
    <>
      {completion.errorMessage && !confirmation ? (
        <p role="alert">{completion.errorMessage}</p>
      ) : null}
      <PersonalRoadmap
        categoryId={categoryId}
        onCategorySelect={onCategorySelect}
        onShowAll={onShowAll}
        viewSwitcher={viewSwitcher}
        onRevealComplete={onRevealComplete}
        categories={createPersonalRoadmapViewModel(displayRequest.checklist)}
        revealTaskId={
          !isRefreshing && targetCategoryId === categoryId
            ? revealTarget?.taskId
            : undefined
        }
        isChangingStatus={
          completion.isPending || isRefreshing || confirmation !== null
        }
        onTaskComplete={(taskId, checked) =>
          void completion.completeTask(taskId, checked)
        }
        onTaskSelect={(taskId) =>
          navigate(`/checklist?taskId=${encodeURIComponent(taskId)}`, {
            state: {
              checklistDetailDepth: 1,
              checklistDetailSource: "roadmap",
            },
          })
        }
      />
      {confirmation ? (
        <ChecklistStatusConfirmationDialog
          isPending={completion.isPending}
          errorMessage={completion.errorMessage}
          onCancel={() => completion.cancelStatusChange(confirmation.itemId)}
          onConfirm={() =>
            void completion.confirmStatusChange(confirmation.itemId)
          }
        />
      ) : null}
    </>
  );
}
