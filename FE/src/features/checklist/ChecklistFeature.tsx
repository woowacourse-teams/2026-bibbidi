import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { useIsMobileLayout } from "../../shared/responsive";
import { useAuth } from "../auth";
import {
  useChecklistCommandRepository,
  useChecklistQueryRepository,
  useChecklistRevision,
} from "./checklistQueryDependencies";
import { ChecklistAudience, ChecklistQueryModel } from "./model/checklistQuery";
import {
  ChecklistQueryAuthenticationRequiredError,
  ChecklistQueryRequestAbortedError,
} from "./repository/checklistQueryRepository";
import { createChecklistViewModel } from "./view-model/createChecklistViewModel";
import { useChecklistTaskCreation } from "./useChecklistTaskCreation";
import { useChecklistTaskCreationCommand } from "./useChecklistTaskCreationCommand";
import { useChecklistItemEditing } from "./useChecklistItemEditing";
import { Checklist } from "./view/Checklist";
import { ChecklistState } from "./view/ChecklistState";
import { ChecklistTaskDetailPageShell } from "./view/ChecklistTaskDetailPage";

type ChecklistRequestState =
  | { audience?: ChecklistAudience; status: "loading" }
  | {
      audience: ChecklistAudience;
      checklistRevision: number;
      requestId: number;
      requestRevision: number;
      status: "empty";
    }
  | { audience: ChecklistAudience; status: "authentication-required" }
  | { audience: ChecklistAudience; status: "error" }
  | {
      audience: ChecklistAudience;
      checklist: ChecklistQueryModel;
      checklistRevision: number;
      requestId: number;
      requestRevision: number;
      status: "success";
    };

function isRequestAborted(error: unknown): boolean {
  return error instanceof ChecklistQueryRequestAbortedError;
}

const checklistDetailDepthStateKey = "checklistDetailDepth";

function getChecklistDetailDepth(state: unknown) {
  if (typeof state !== "object" || state === null) {
    return null;
  }

  const depth = Reflect.get(state, checklistDetailDepthStateKey);

  return Number.isInteger(depth) && Number(depth) > 0 ? Number(depth) : null;
}

function createChecklistDetailState(state: unknown, depth: number) {
  return {
    ...(typeof state === "object" && state !== null ? state : {}),
    [checklistDetailDepthStateKey]: depth,
  };
}

function getSelectedChecklistItemId(taskId: string | null): number | null {
  const match = /^checklist-item-(\d+)$/.exec(taskId ?? "");
  const itemId = match ? Number(match[1]) : Number.NaN;

  return Number.isSafeInteger(itemId) && itemId > 0 ? itemId : null;
}

export function ChecklistFeature() {
  const { authState, refreshAuth } = useAuth();
  const audience: ChecklistAudience | undefined =
    authState.status === "authenticated"
      ? "authenticated"
      : authState.status === "guest"
        ? "guest"
        : undefined;
  const sessionIdentity =
    authState.status === "authenticated" || authState.status === "synchronizing"
      ? `authenticated:${authState.user.nickname}`
      : authState.status === "guest"
        ? "guest"
        : undefined;
  const checklistRepository = useChecklistQueryRepository();
  const checklistCommandRepository = useChecklistCommandRepository();
  const checklistRevision = useChecklistRevision();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("taskId");
  const itemEditing = useChecklistItemEditing(
    checklistCommandRepository,
    refreshAuth,
    audience,
    getSelectedChecklistItemId(selectedTaskId),
  );
  const taskCreationCommand = useChecklistTaskCreationCommand(
    checklistCommandRepository,
    refreshAuth,
    audience,
    sessionIdentity,
  );
  const [requestState, setRequestState] = useState<ChecklistRequestState>({
    status: "loading",
  });
  const [isLoginRequiredOpen, setIsLoginRequiredOpen] = useState(false);
  const latestRequestIdRef = useRef(0);
  const [requestRevision, setRequestRevision] = useState(0);
  const isMobileLayout = useIsMobileLayout();
  const isTaskCreationOpen =
    searchParams.get("addTask") === "true" && selectedTaskId === null;
  const updateTaskCreation = useCallback(
    (isOpen: boolean) => {
      setSearchParams((currentSearchParams) => {
        const nextSearchParams = new URLSearchParams(currentSearchParams);

        if (isOpen) {
          nextSearchParams.set("addTask", "true");
          nextSearchParams.delete("taskId");
        } else {
          nextSearchParams.delete("addTask");
        }

        return nextSearchParams;
      });
    },
    [setSearchParams],
  );
  const taskCreation = useChecklistTaskCreation({
    isOpen: audience === "authenticated" && isTaskCreationOpen,
    onOpenChange: updateTaskCreation,
    onSubmit: taskCreationCommand.submit,
    sessionIdentity,
    submissionState: taskCreationCommand.submissionState,
  });

  useEffect(() => {
    if (!audience) {
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    const controller = new AbortController();
    let ignoresResult = false;

    void checklistRepository
      .getChecklist(audience, controller.signal)
      .then((checklist) => {
        if (ignoresResult) {
          return;
        }

        if (checklist.categories.length === 0) {
          setRequestState({
            audience,
            checklistRevision,
            requestId,
            requestRevision,
            status: "empty",
          });
          return;
        }

        setRequestState({
          audience,
          checklist,
          checklistRevision,
          requestId,
          requestRevision,
          status: "success",
        });
      })
      .catch((error: unknown) => {
        if (
          ignoresResult ||
          controller.signal.aborted ||
          isRequestAborted(error)
        ) {
          return;
        }

        const requiresAuthentication =
          error instanceof ChecklistQueryAuthenticationRequiredError;

        if (requiresAuthentication) {
          refreshAuth();
        }

        setRequestState({
          audience,
          status: requiresAuthentication ? "authentication-required" : "error",
        });
      });

    return () => {
      ignoresResult = true;
      controller.abort();
    };
  }, [
    audience,
    checklistRepository,
    checklistRevision,
    refreshAuth,
    requestRevision,
  ]);

  const updateTaskSelection = useCallback(
    (
      taskId: string | null,
      options: { replace?: boolean; state?: unknown } = {},
    ) => {
      setSearchParams((currentSearchParams) => {
        const nextSearchParams = new URLSearchParams(currentSearchParams);

        if (taskId === null) {
          nextSearchParams.delete("taskId");
        } else {
          nextSearchParams.set("taskId", taskId);
          nextSearchParams.delete("addTask");
        }

        return nextSearchParams;
      }, options);
    },
    [setSearchParams],
  );
  const closeTaskDetail = useCallback(() => {
    if (selectedTaskId !== null) {
      updateTaskSelection(null);
    }
  }, [selectedTaskId, updateTaskSelection]);
  const backFromTaskDetail = useCallback(() => {
    if (selectedTaskId === null) {
      return;
    }

    const detailDepth = getChecklistDetailDepth(location.state);

    if (detailDepth !== null) {
      navigate(-detailDepth);
    } else {
      updateTaskSelection(null, { replace: true });
    }
  }, [location.state, navigate, selectedTaskId, updateTaskSelection]);
  const selectTask = useCallback(
    (taskId: string) => {
      if (taskId !== selectedTaskId || isTaskCreationOpen) {
        const currentDetailDepth = getChecklistDetailDepth(location.state);
        const nextDetailDepth =
          selectedTaskId === null
            ? 1
            : currentDetailDepth === null
              ? null
              : currentDetailDepth + 1;

        updateTaskSelection(taskId, {
          state:
            nextDetailDepth === null
              ? undefined
              : createChecklistDetailState(location.state, nextDetailDepth),
        });
      }
    },
    [isTaskCreationOpen, location.state, selectedTaskId, updateTaskSelection],
  );

  useEffect(() => {
    if (
      selectedTaskId === null ||
      requestState.audience !== audience ||
      (requestState.status !== "empty" && requestState.status !== "success") ||
      requestState.checklistRevision !== checklistRevision ||
      requestState.requestId !== latestRequestIdRef.current ||
      requestState.requestRevision !== requestRevision
    ) {
      return;
    }

    const selectedTaskExists =
      requestState.status === "success" &&
      requestState.checklist.categories.some((category) =>
        category.items.some((item) => item.id === selectedTaskId),
      );

    if (!selectedTaskExists) {
      updateTaskSelection(null, { replace: true });
    }
  }, [
    audience,
    checklistRevision,
    requestRevision,
    requestState,
    selectedTaskId,
    updateTaskSelection,
  ]);

  const handleRetry = () => {
    if (!audience) {
      refreshAuth();
      return;
    }

    setRequestState({ audience, status: "loading" });
    setRequestRevision((revision) => revision + 1);
  };

  const renderChecklistState = (state: ReactNode) =>
    isMobileLayout && selectedTaskId !== null ? (
      <ChecklistTaskDetailPageShell
        onBack={backFromTaskDetail}
        title="할 일 상세"
      >
        {state}
      </ChecklistTaskDetailPageShell>
    ) : (
      state
    );

  if (!audience) {
    return renderChecklistState(
      <ChecklistState
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
      />,
    );
  }

  if (requestState.audience !== audience) {
    return renderChecklistState(<ChecklistState status="loading" />);
  }

  if (
    requestState.status === "authentication-required" ||
    requestState.status === "error"
  ) {
    return renderChecklistState(
      <ChecklistState onRetry={handleRetry} status={requestState.status} />,
    );
  }

  if (requestState.status !== "success") {
    return renderChecklistState(
      <ChecklistState status={requestState.status} />,
    );
  }

  return (
    <Checklist
      categories={createChecklistViewModel(requestState.checklist)}
      isAuthenticated={audience === "authenticated"}
      isLoginRequiredOpen={isLoginRequiredOpen}
      itemEditing={audience === "authenticated" ? itemEditing : undefined}
      onBackTaskDetail={backFromTaskDetail}
      onCancelLoginRequired={() => setIsLoginRequiredOpen(false)}
      onCloseTaskDetail={closeTaskDetail}
      onOpenTaskCreation={() => {
        if (audience === "authenticated") {
          taskCreation.open();
        } else {
          setIsLoginRequiredOpen(true);
        }
      }}
      onSelectTask={selectTask}
      onVisitLogin={() => {
        setIsLoginRequiredOpen(false);
        navigate("/login");
      }}
      selectedTaskId={selectedTaskId}
      taskCreation={taskCreation}
    />
  );
}
