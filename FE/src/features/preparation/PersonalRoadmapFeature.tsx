import { ReactNode, useState } from "react";
import { useNavigate } from "react-router";
import { ChecklistStatusConfirmationDialog } from "../checklist/view/ChecklistStatusConfirmationDialog";
import { useRoadmapChecklist } from "./hooks/useRoadmapChecklist";
import { useRoadmapTaskCompletion } from "./hooks/useRoadmapTaskCompletion";
import { createPersonalRoadmapViewModel } from "./view-model/createPersonalRoadmapViewModel";
import { PersonalRoadmap } from "./view/PersonalRoadmap";
import { PreparationRoadmapState } from "./view/PreparationRoadmapState";

export function PersonalRoadmapFeature(props: {
  categoryId?: string | null;
  onCategorySelect: (id: string) => void;
  onShowAll: () => void;
  viewSwitcher: ReactNode;
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
  if (displayRequest.status !== "success") {
    return (
      <>
        {props.viewSwitcher}
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
        {...props}
        categories={createPersonalRoadmapViewModel(displayRequest.checklist)}
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
