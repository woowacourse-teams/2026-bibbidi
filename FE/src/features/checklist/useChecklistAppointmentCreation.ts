import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { analytics } from "../../infrastructure/analytics";
import {
  AppointmentCreationSource,
  createAppointmentCreateEvent,
} from "./analytics/checklistAnalytics";
import { AppointmentCreationError } from "./model/appointmentCreation";
import {
  CHECKLIST_APPOINTMENT_TEXT_MAX_LENGTH,
  ChecklistAppointmentFormDraft,
  ChecklistAppointmentFormErrors,
  ChecklistAppointmentFormField,
  emptyAppointmentDraft,
  getFirstAppointmentErrorField,
  toLocalDateTime,
  toOptionalAppointmentText,
  validateAppointmentDraft,
  validateAppointmentEndTime,
} from "./model/appointmentForm";
import { MyChecklistRequestAbortedError } from "./repository/myChecklistQueryRepository";

export { CHECKLIST_APPOINTMENT_TEXT_MAX_LENGTH };

export interface ChecklistAppointmentCreationInput {
  checklistItemId: number;
  date: string;
  endTime?: string;
  memo?: string;
  place?: string;
  startTime?: string;
  title: string;
}

export type ChecklistAppointmentCreationSubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { message: string; retryLabel: string; status: "error" };

export type ChecklistAppointmentCreationDraft = ChecklistAppointmentFormDraft;
export type ChecklistAppointmentCreationErrors = ChecklistAppointmentFormErrors;
export type ChecklistAppointmentCreationField = ChecklistAppointmentFormField;

interface UseChecklistAppointmentCreationOptions {
  checklistItemId: number | null;
  isAuthenticated: boolean;
  onSubmit?: (
    input: ChecklistAppointmentCreationInput,
    signal: AbortSignal,
  ) => Promise<boolean | void> | boolean | void;
  onRetryRefresh?: (signal: AbortSignal) => Promise<void>;
  sessionIdentity?: string;
}

export interface ChecklistAppointmentCreationController {
  canOpen: boolean;
  canSubmit: boolean;
  cancel: () => void;
  changeDate: (date: string) => void;
  changeEndTime: (endTime: string) => void;
  changeMemo: (memo: string) => void;
  changePlace: (place: string) => void;
  changeStartTime: (startTime: string) => void;
  changeTitle: (title: string) => void;
  draft: ChecklistAppointmentCreationDraft;
  errors: ChecklistAppointmentCreationErrors;
  isOpen: boolean;
  open: (source?: AppointmentCreationSource) => void;
  submissionState: ChecklistAppointmentCreationSubmissionState;
  submit: () => Promise<ChecklistAppointmentCreationField | null>;
  touchDate: () => void;
  touchEndTime: () => void;
  touchPlace: () => void;
  touchStartTime: () => void;
  touchTitle: () => void;
}

const emptyDraft = emptyAppointmentDraft;

const idleSubmissionState: ChecklistAppointmentCreationSubmissionState = {
  status: "idle",
};

export function useChecklistAppointmentCreation({
  checklistItemId,
  isAuthenticated,
  onSubmit,
  onRetryRefresh,
  sessionIdentity,
}: UseChecklistAppointmentCreationOptions): ChecklistAppointmentCreationController {
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState<ChecklistAppointmentCreationErrors>({});
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
      setErrors({});
      setIsOpen(false);
      setSubmissionState(idleSubmissionState);
    });

    return () => {
      isActive = false;
    };
  }, [activeContextKey, contextKey]);

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
      setErrors({});
      setSubmissionState(idleSubmissionState);
      setIsOpen(false);
    });

    return () => {
      isActive = false;
    };
  }, [onSubmit, onRetryRefresh]);

  const replaceError = (
    field: ChecklistAppointmentCreationField,
    message?: string,
  ) => {
    setErrors((current) => {
      const next = { ...current };

      if (message) {
        next[field] = message;
      } else {
        delete next[field];
      }

      return next;
    });
  };

  const resetAndClose = () => {
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
      if (!submissionInFlightRef.current) {
        resetAndClose();
      }
    },
    changeDate: (date) => {
      setDraft((current) => ({ ...current, date }));
      if (errors.date) {
        replaceError("date", validateAppointmentDraft({ ...draft, date }).date);
      }
    },
    changeEndTime: (endTime) => {
      setDraft((current) => ({ ...current, endTime }));
      if (errors.endTime) {
        replaceError(
          "endTime",
          validateAppointmentEndTime(draft.startTime, endTime),
        );
      }
    },
    changeMemo: (memo) => setDraft((current) => ({ ...current, memo })),
    changePlace: (place) => {
      setDraft((current) => ({ ...current, place }));
      if (errors.place) {
        replaceError(
          "place",
          validateAppointmentDraft({ ...draft, place }).place,
        );
      }
    },
    changeStartTime: (startTime) => {
      setDraft((current) => ({ ...current, startTime }));
      if (errors.startTime) {
        replaceError(
          "startTime",
          validateAppointmentDraft({ ...draft, startTime }).startTime,
        );
      }
      if (errors.endTime) {
        replaceError(
          "endTime",
          validateAppointmentEndTime(startTime, draft.endTime),
        );
      }
    },
    changeTitle: (title) => {
      setDraft((current) => ({ ...current, title }));
      if (errors.title) {
        replaceError(
          "title",
          validateAppointmentDraft({ ...draft, title }).title,
        );
      }
    },
    draft,
    errors,
    isOpen: isCurrentContext && isOpen,
    open: (source = "checklist") => {
      if (isAuthenticated && checklistItemId !== null) {
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
        return firstError;
      }

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
          needsRefreshRef.current =
            error instanceof AppointmentCreationError &&
            error.reason === "refresh-failed";
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
    touchDate: () => replaceError("date", validateAppointmentDraft(draft).date),
    touchEndTime: () =>
      replaceError(
        "endTime",
        validateAppointmentEndTime(draft.startTime, draft.endTime),
      ),
    touchPlace: () =>
      replaceError("place", validateAppointmentDraft(draft).place),
    touchStartTime: () => {
      const nextErrors = validateAppointmentDraft(draft);
      replaceError("startTime", nextErrors.startTime);
      replaceError("endTime", nextErrors.endTime);
    },
    touchTitle: () =>
      replaceError("title", validateAppointmentDraft(draft).title),
  };
}
