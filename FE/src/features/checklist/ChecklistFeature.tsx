import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { useIsMobileLayout } from "../../shared/responsive";
import { useAuth } from "../auth";
import {
  useChecklistCommandRepository,
  useChecklistCacheRepository,
  useChecklistQueryRepository,
  useChecklistRevision,
} from "./checklistQueryDependencies";
import { ChecklistAudience, ChecklistQueryModel } from "./model/checklistQuery";
import {
  ChecklistQueryAuthenticationRequiredError,
  ChecklistQueryRequestAbortedError,
} from "./repository/checklistQueryRepository";
import { AppointmentCreationError } from "./model/appointmentCreation";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistRequestAbortedError,
} from "./repository/myChecklistQueryRepository";
import { createChecklistViewModel } from "./view-model/createChecklistViewModel";
import {
  ChecklistAppointmentCreationInput,
  useChecklistAppointmentCreation,
} from "./useChecklistAppointmentCreation";
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
  | {
      audience: ChecklistAudience;
      errorMessage?: string;
      status: "error";
    }
  | {
      audience: ChecklistAudience;
      checklist: ChecklistQueryModel;
      checklistRevision: number;
      requestId: number;
      requestRevision: number;
      status: "success";
    };

type LoginRequiredReason = "schedule-creation" | "task-creation";

interface ChecklistFeatureProps {
  onSubmitAppointment?: (
    input: ChecklistAppointmentCreationInput,
  ) => Promise<boolean | void> | boolean | void;
}

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

export function ChecklistFeature({
  onSubmitAppointment,
}: ChecklistFeatureProps = {}) {
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
  const checklistCacheRepository = useChecklistCacheRepository();
  const checklistCommandRepository = useChecklistCommandRepository();
  const refreshAppointments = useCallback(
    async (signal: AbortSignal) => {
      try {
        checklistCacheRepository.invalidate();
        await checklistCacheRepository.getChecklist(signal);
      } catch (error) {
        if (signal.aborted || error instanceof MyChecklistRequestAbortedError) {
          throw new MyChecklistRequestAbortedError({ cause: error });
        }
        if (error instanceof MyChecklistAuthenticationRequiredError) {
          refreshAuth();
        }
        throw new AppointmentCreationError("refresh-failed", { cause: error });
      }
    },
    [checklistCacheRepository, refreshAuth],
  );
  const submitAppointment = useCallback(
    async (input: ChecklistAppointmentCreationInput, signal: AbortSignal) => {
      try {
        await checklistCommandRepository.createAppointment(
          input.checklistItemId,
          {
            title: input.title,
            date: input.date,
            startTime: input.startTime ?? null,
            endTime: input.endTime ?? null,
            place: input.place ?? null,
            memo: input.memo ?? null,
          },
          signal,
        );
      } catch (error) {
        if (
          error instanceof MyChecklistAuthenticationRequiredError ||
          (error instanceof AppointmentCreationError &&
            error.cause instanceof MyChecklistAuthenticationRequiredError)
        ) {
          refreshAuth();
        }
        throw error;
      }
      await refreshAppointments(signal);
    },
    [checklistCommandRepository, refreshAppointments, refreshAuth],
  );
  const checklistRevision = useChecklistRevision();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("taskId");
  const selectedChecklistItemId = getSelectedChecklistItemId(selectedTaskId);
  const [requestState, setRequestState] = useState<ChecklistRequestState>({
    status: "loading",
  });
  const refreshFailureRef = useRef<{
    audience: ChecklistAudience;
    message: string;
  }>(undefined);
  const handleRefreshFailed = useCallback(
    (message: string) => {
      if (!audience) {
        return;
      }

      refreshFailureRef.current = { audience, message };
      setRequestState({ audience, errorMessage: message, status: "error" });
    },
    [audience, setRequestState],
  );
  const itemEditing = useChecklistItemEditing(
    checklistCommandRepository,
    refreshAuth,
    audience,
    selectedChecklistItemId,
    handleRefreshFailed,
  );
  const taskCreationCommand = useChecklistTaskCreationCommand(
    checklistCommandRepository,
    refreshAuth,
    audience,
    sessionIdentity,
  );
  const [loginRequiredReason, setLoginRequiredReason] =
    useState<LoginRequiredReason | null>(null);
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
  const appointmentCreationChecklistItemId =
    requestState.status === "success" &&
    requestState.audience === audience &&
    requestState.checklist.categories.some((category) =>
      category.items.some(
        (item) =>
          item.id === selectedTaskId &&
          item.checklistItemId === selectedChecklistItemId,
      ),
    )
      ? selectedChecklistItemId
      : null;
  const appointmentCreation = useChecklistAppointmentCreation({
    checklistItemId: appointmentCreationChecklistItemId,
    isAuthenticated: audience === "authenticated",
    onSubmit: onSubmitAppointment ?? submitAppointment,
    onRetryRefresh: onSubmitAppointment ? undefined : refreshAppointments,
    sessionIdentity,
  });
  const requestScheduleCreation = useCallback(() => {
    if (audience === "guest") {
      setLoginRequiredReason("schedule-creation");
      return;
    }

    if (audience === "authenticated") {
      appointmentCreation.open();
    }
  }, [appointmentCreation, audience]);

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

        refreshFailureRef.current = undefined;

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

        if (requiresAuthentication) {
          setRequestState({ audience, status: "authentication-required" });
          return;
        }

        const refreshFailure = refreshFailureRef.current;
        setRequestState({
          audience,
          errorMessage:
            refreshFailure?.audience === audience
              ? refreshFailure.message
              : undefined,
          status: "error",
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

    refreshFailureRef.current = undefined;
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
      <ChecklistState
        errorMessage={
          requestState.status === "error"
            ? requestState.errorMessage
            : undefined
        }
        onRetry={handleRetry}
        status={requestState.status}
      />,
    );
  }

  if (requestState.status !== "success") {
    return renderChecklistState(
      <ChecklistState status={requestState.status} />,
    );
  }

  return (
    <Checklist
      appointmentCreation={
        audience === "authenticated" ? appointmentCreation : undefined
      }
      categories={createChecklistViewModel(requestState.checklist)}
      isAuthenticated={audience === "authenticated"}
      itemEditing={audience === "authenticated" ? itemEditing : undefined}
      loginRequiredReason={loginRequiredReason}
      onBackTaskDetail={backFromTaskDetail}
      onCancelLoginRequired={() => setLoginRequiredReason(null)}
      onCloseTaskDetail={closeTaskDetail}
      onOpenTaskCreation={() => {
        if (audience === "authenticated") {
          taskCreation.open();
        } else {
          setLoginRequiredReason("task-creation");
        }
      }}
      onRequestScheduleCreation={requestScheduleCreation}
      onSelectTask={selectTask}
      onVisitLogin={() => {
        setLoginRequiredReason(null);
        navigate("/login");
      }}
      selectedTaskId={selectedTaskId}
      taskCreation={taskCreation}
    />
  );
}
