import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppointmentDraft } from "./useAppointmentDraft";

import { analytics } from "../../infrastructure/analytics";
import {
  addErrorAction,
  reportHandledError,
} from "../../infrastructure/error-tracking";
import {
  AppointmentCreationSource,
  createAppointmentCreateEvent,
} from "./analytics/checklistAnalytics";
import { AppointmentCreationError } from "./model/appointmentCreation";
import {
  ChecklistAppointmentFormController,
  ChecklistAppointmentDiscardController,
  emptyAppointmentDraft,
  getFirstAppointmentErrorField,
  toLocalDateTime,
  toOptionalAppointmentText,
  validateAppointmentDraft,
} from "./model/appointmentForm";
import { MyChecklistRequestAbortedError } from "./repository/myChecklistQueryRepository";

export interface ChecklistAppointmentCreationInput {
  checklistItemId: number;
  date: string;
  endTime?: string;
  memo?: string;
  place?: string;
  startTime?: string;
  title: string;
}

type ChecklistAppointmentCreationSubmissionState =
  ChecklistAppointmentFormController["submissionState"];

interface UseChecklistAppointmentCreationOptions {
  confirmDiscard?: boolean;
  checklistItemId: number | null;
  isAuthenticated: boolean;
  onSubmit?: (
    input: ChecklistAppointmentCreationInput,
    signal: AbortSignal,
  ) => Promise<boolean | void> | boolean | void;
  onRetryRefresh?: (signal: AbortSignal) => Promise<void>;
  sessionIdentity?: string;
}

export interface ChecklistAppointmentCreationController
  extends
    ChecklistAppointmentFormController,
    ChecklistAppointmentDiscardController {
  isOpen: boolean;
  canOpen: boolean;
  open: (source?: AppointmentCreationSource) => void;
}

const emptyDraft = emptyAppointmentDraft;

const idleSubmissionState: ChecklistAppointmentCreationSubmissionState = {
  status: "idle",
};

export function useChecklistAppointmentCreation({
  confirmDiscard = false,
  checklistItemId,
  isAuthenticated,
  onSubmit,
  onRetryRefresh,
  sessionIdentity,
}: UseChecklistAppointmentCreationOptions): ChecklistAppointmentCreationController {
  const { form, setDraft, setErrors } = useAppointmentDraft();
  const { draft } = form;
  const [isDiscardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [submissionState, setSubmissionState] =
    useState<ChecklistAppointmentCreationSubmissionState>(idleSubmissionState);
  const contextKey = `${isAuthenticated ? "authenticated" : "unauthenticated"}:${
    sessionIdentity ?? "unknown"
  }:${checklistItemId ?? "none"}`;
  const [activeContextKey, setActiveContextKey] = useState(contextKey);
  const requestGenerationRef = useRef(0);
  const submissionInFlightRef = useRef(false);
  const requestControllerRef = useRef<AbortController | null>(null);
  const needsRefreshRef = useRef(false);
  const sourceRef = useRef<AppointmentCreationSource>("checklist");
  const commandRef = useRef({ onSubmit, onRetryRefresh });
  const isMountedRef = useRef(true);
  const isCurrentContext = activeContextKey === contextKey;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      requestControllerRef.current?.abort();
      requestGenerationRef.current += 1;
      submissionInFlightRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (activeContextKey === contextKey) {
      return;
    }

    requestGenerationRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    needsRefreshRef.current = false;
    sourceRef.current = "checklist";
    submissionInFlightRef.current = false;
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) {
        return;
      }

      setActiveContextKey(contextKey);
      setDraft(emptyDraft);
      setDiscardDialogOpen(false);
      setErrors({});
      setIsOpen(false);
      setSubmissionState(idleSubmissionState);
    });

    return () => {
      isActive = false;
    };
  }, [activeContextKey, contextKey, setDraft, setErrors]);

  useEffect(() => {
    const previousCommand = commandRef.current;
    commandRef.current = { onSubmit, onRetryRefresh };
    if (
      (previousCommand.onSubmit === onSubmit &&
        previousCommand.onRetryRefresh === onRetryRefresh) ||
      !submissionInFlightRef.current
    ) {
      return;
    }

    requestGenerationRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    submissionInFlightRef.current = false;
    needsRefreshRef.current = false;
    sourceRef.current = "checklist";
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) return;
      setDraft(emptyDraft);
      setDiscardDialogOpen(false);
      setErrors({});
      setSubmissionState(idleSubmissionState);
      setIsOpen(false);
    });

    return () => {
      isActive = false;
    };
  }, [onSubmit, onRetryRefresh, setDraft, setErrors]);

  const resetAndClose = () => {
    setDiscardDialogOpen(false);
    requestGenerationRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    needsRefreshRef.current = false;
    submissionInFlightRef.current = false;
    setDraft(emptyDraft);
    setErrors({});
    setSubmissionState(idleSubmissionState);
    setIsOpen(false);
  };

  return {
    canOpen: isCurrentContext && isAuthenticated && checklistItemId !== null,
    canSubmit:
      isAuthenticated && checklistItemId !== null && onSubmit !== undefined,
    cancel: () => {
      if (submissionInFlightRef.current) return;
      if (
        confirmDiscard &&
        !needsRefreshRef.current &&
        Object.keys(emptyDraft).some(
          (key) =>
            draft[key as keyof typeof draft] !==
            emptyDraft[key as keyof typeof draft],
        )
      )
        setDiscardDialogOpen(true);
      else resetAndClose();
    },
    isDiscardDialogOpen: isCurrentContext && isOpen && isDiscardDialogOpen,
    cancelDiscard: () => setDiscardDialogOpen(false),
    confirmDiscard: () => {
      if (!submissionInFlightRef.current) resetAndClose();
    },
    ...form,
    isOpen: isCurrentContext && isOpen,
    open: (source = "checklist") => {
      if (isAuthenticated && checklistItemId !== null) {
        if (!isOpen)
          analytics.track({
            name: "appointment_form_view",
            parameters: { source },
          });
        sourceRef.current = source;
        setIsOpen(true);
      }
    },
    submissionState,
    submit: async () => {
      if (
        submissionInFlightRef.current ||
        !isAuthenticated ||
        checklistItemId === null ||
        !onSubmit
      ) {
        return null;
      }

      const nextErrors = validateAppointmentDraft(draft);
      setErrors(nextErrors);
      const firstError = getFirstAppointmentErrorField(nextErrors);

      if (firstError) {
        analytics.track({
          name: "appointment_create_failed",
          parameters: { source: sourceRef.current, failure_kind: "validation" },
        });
        return firstError;
      }

      if (!needsRefreshRef.current)
        analytics.track({
          name: "appointment_submit",
          parameters: { source: sourceRef.current },
        });
      addErrorAction("appointment.create");

      const requestGeneration = requestGenerationRef.current + 1;
      requestGenerationRef.current = requestGeneration;
      const requestController = new AbortController();
      requestControllerRef.current = requestController;
      submissionInFlightRef.current = true;
      setSubmissionState({ status: "submitting" });

      try {
        const input = {
          checklistItemId,
          date: draft.date,
          endTime: toLocalDateTime(draft.date, draft.endTime),
          memo: toOptionalAppointmentText(draft.memo),
          place: toOptionalAppointmentText(draft.place),
          startTime: toLocalDateTime(draft.date, draft.startTime),
          title: draft.title.trim(),
        };
        const didSucceed =
          needsRefreshRef.current && onRetryRefresh
            ? await onRetryRefresh(requestController.signal).then(() => true)
            : await onSubmit(input, requestController.signal);

        if (
          !isMountedRef.current ||
          requestGenerationRef.current !== requestGeneration
        ) {
          return null;
        }

        if (didSucceed !== false) {
          analytics.track(createAppointmentCreateEvent(sourceRef.current));
          requestControllerRef.current = null;
          resetAndClose();
        } else {
          setSubmissionState(idleSubmissionState);
        }
      } catch (error) {
        if (
          isMountedRef.current &&
          requestGenerationRef.current === requestGeneration &&
          !requestController.signal.aborted &&
          !(error instanceof MyChecklistRequestAbortedError)
        ) {
          const wasRefreshing = needsRefreshRef.current;
          needsRefreshRef.current =
            error instanceof AppointmentCreationError &&
            error.reason === "refresh-failed";
          if (
            !(error instanceof AppointmentCreationError) ||
            !["invalid-request", "item-not-found", "forbidden"].includes(
              error.reason,
            )
          ) {
            reportHandledError(error, {
              feature: "calendar",
              operation: "appointment_create",
              failureKind:
                error instanceof AppointmentCreationError
                  ? error.reason
                  : "unknown",
              level: needsRefreshRef.current ? "warning" : "error",
            });
          }
          if (!wasRefreshing && !needsRefreshRef.current) {
            analytics.track({
              name: "appointment_create_failed",
              parameters: {
                source: sourceRef.current,
                failure_kind:
                  error instanceof AppointmentCreationError
                    ? error.reason
                    : "unknown",
              },
            });
          }
          setSubmissionState({
            message:
              error instanceof AppointmentCreationError
                ? error.message
                : "일정을 저장하지 못했어요. 다시 시도해 주세요.",
            retryLabel: needsRefreshRef.current
              ? "목록 다시 불러오기"
              : "다시 시도",
            status: "error",
          });
        }
      } finally {
        if (requestGenerationRef.current === requestGeneration) {
          requestControllerRef.current = null;
          submissionInFlightRef.current = false;
        }
      }

      return null;
    },
  };
}
