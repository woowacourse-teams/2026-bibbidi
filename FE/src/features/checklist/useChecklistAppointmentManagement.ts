import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  addErrorAction,
  reportHandledError,
} from "../../infrastructure/error-tracking";
import { ChecklistAudience } from "./model/checklistQuery";
import {
  ChecklistAppointmentFormController,
  ChecklistAppointmentEditingInput,
  ChecklistAppointmentDiscardController,
  ChecklistAppointmentFormDraft,
  emptyAppointmentDraft,
  getFirstAppointmentErrorField,
  toLocalDateTime,
  toOptionalAppointmentText,
  toTimeInputValue,
  validateAppointmentDraft,
} from "./model/appointmentForm";
import { AppointmentManagementError } from "./model/appointmentManagement";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistRequestAbortedError,
} from "./repository/myChecklistQueryRepository";
import { MyChecklistCommandRepository } from "./repository/myChecklistCommandRepository";
import { useAppointmentDraft } from "./useAppointmentDraft";

type AppointmentOperation = "completion" | "delete" | "update";

export type AppointmentOperationFeedback =
  | { status: "idle" }
  | {
      appointmentId: number;
      operation: AppointmentOperation;
      status: "pending";
    }
  | {
      appointmentId: number;
      errorMessage: string;
      operation: AppointmentOperation;
      status: "error";
    };

interface AppointmentDeletionConfirmation {
  appointmentId: number;
}

export interface ChecklistAppointmentEditingController
  extends
    ChecklistAppointmentFormController,
    ChecklistAppointmentDiscardController {
  isOpen: boolean;
}

export interface ChecklistAppointmentManagementController {
  cancelDelete: () => void;
  changeCompletion: (appointmentId: number, isDone: boolean) => Promise<void>;
  closeMenu: () => void;
  confirmDelete: () => Promise<void>;
  deletionConfirmation: AppointmentDeletionConfirmation | null;
  editing: ChecklistAppointmentEditingController;
  editingAppointmentId: number | null;
  openMenuAppointmentId: number | null;
  operationFeedback: AppointmentOperationFeedback;
  requestDelete: (appointmentId: number) => void;
  startEditing: (appointment: ChecklistAppointmentEditingInput) => void;
  toggleMenu: (appointmentId: number) => void;
}

interface UseChecklistAppointmentManagementOptions {
  confirmDiscard?: boolean;
  audience: ChecklistAudience | undefined;
  checklistItemId: number | null;
  commandRepository: MyChecklistCommandRepository;
  refreshAuth: () => void;
  sessionIdentity?: string;
}

function createDraft(
  appointment: ChecklistAppointmentEditingInput,
): ChecklistAppointmentFormDraft {
  return {
    date: appointment.date,
    endTime: toTimeInputValue(appointment.endTime),
    memo: appointment.memo ?? "",
    place: appointment.place ?? "",
    startTime: toTimeInputValue(appointment.startTime),
    title: appointment.title,
  };
}

function operationErrorMessage(
  error: unknown,
  operation: AppointmentOperation,
) {
  if (error instanceof MyChecklistAuthenticationRequiredError) {
    return "로그인 상태를 확인하고 있어요. 잠시 후 다시 시도해 주세요.";
  }
  if (error instanceof AppointmentManagementError) {
    return error.message;
  }
  if (operation === "delete") {
    return "일정을 삭제하지 못했어요. 다시 시도해 주세요.";
  }
  if (operation === "completion") {
    return "일정 상태를 변경하지 못했어요. 다시 시도해 주세요.";
  }
  return "일정을 저장하지 못했어요. 다시 시도해 주세요.";
}

export function useChecklistAppointmentManagement({
  confirmDiscard = false,
  audience,
  checklistItemId,
  commandRepository,
  refreshAuth,
  sessionIdentity,
}: UseChecklistAppointmentManagementOptions): ChecklistAppointmentManagementController {
  const [openMenuAppointmentId, setOpenMenuAppointmentId] = useState<
    number | null
  >(null);
  const [editingAppointmentId, setEditingAppointmentId] = useState<
    number | null
  >(null);
  const { draft, errors, setDraft, setErrors, ...draftFields } =
    useAppointmentDraft();
  const [initialDraft, setInitialDraft] = useState(emptyAppointmentDraft);
  const [isDiscardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [deletionConfirmation, setDeletionConfirmation] =
    useState<AppointmentDeletionConfirmation | null>(null);
  const [operationFeedback, setOperationFeedback] =
    useState<AppointmentOperationFeedback>({ status: "idle" });
  const requestControllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const contextKey = `${audience ?? "unknown"}:${sessionIdentity ?? "unknown"}:${checklistItemId ?? "none"}`;
  const [activeContextKey, setActiveContextKey] = useState(contextKey);
  const isCurrentContext = contextKey === activeContextKey;

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
      inFlightRef.current = false;
    },
    [],
  );

  useLayoutEffect(() => {
    if (activeContextKey === contextKey) {
      return;
    }

    requestControllerRef.current?.abort();
    inFlightRef.current = false;
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) {
        return;
      }
      setDiscardDialogOpen(false);
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      inFlightRef.current = false;
      setOpenMenuAppointmentId(null);
      setEditingAppointmentId(null);
      setDraft(emptyAppointmentDraft);
      setErrors({});
      setDeletionConfirmation(null);
      setOperationFeedback({ status: "idle" });
      setActiveContextKey(contextKey);
    });

    return () => {
      isActive = false;
    };
  }, [activeContextKey, contextKey, setDraft, setErrors]);

  const run = async (
    appointmentId: number,
    operation: AppointmentOperation,
    command: (signal: AbortSignal) => Promise<void>,
  ) => {
    if (inFlightRef.current || audience !== "authenticated") {
      return false;
    }

    const controller = new AbortController();
    requestControllerRef.current = controller;
    inFlightRef.current = true;
    setOperationFeedback({ appointmentId, operation, status: "pending" });
    addErrorAction(`appointment.${operation}`);

    try {
      await command(controller.signal);
      if (controller.signal.aborted) {
        return false;
      }
      setOperationFeedback({ status: "idle" });
      return true;
    } catch (error) {
      if (
        controller.signal.aborted ||
        error instanceof MyChecklistRequestAbortedError
      ) {
        return false;
      }
      if (error instanceof MyChecklistAuthenticationRequiredError) {
        refreshAuth();
      } else if (
        !(error instanceof AppointmentManagementError) ||
        error.reason === "unknown"
      ) {
        reportHandledError(error, {
          feature: "checklist",
          operation: `appointment_${operation}`,
          failureKind:
            error instanceof AppointmentManagementError
              ? error.reason
              : "unknown",
        });
      }
      setOperationFeedback({
        appointmentId,
        errorMessage: operationErrorMessage(error, operation),
        operation,
        status: "error",
      });
      return false;
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        inFlightRef.current = false;
      }
    }
  };

  const editingSubmissionState =
    operationFeedback.status !== "idle" &&
    operationFeedback.operation === "update" &&
    operationFeedback.appointmentId === editingAppointmentId
      ? operationFeedback.status === "pending"
        ? ({ status: "submitting" } as const)
        : ({
            message: operationFeedback.errorMessage,
            retryLabel: "다시 시도",
            status: "error",
          } as const)
      : ({ status: "idle" } as const);

  const closeEditing = () => {
    setDiscardDialogOpen(false);
    setEditingAppointmentId(null);
    setDraft(emptyAppointmentDraft);
    setErrors({});
    setOperationFeedback({ status: "idle" });
  };

  return {
    cancelDelete: () => {
      if (!inFlightRef.current) {
        setDeletionConfirmation(null);
        setOperationFeedback({ status: "idle" });
      }
    },
    async changeCompletion(appointmentId, isDone) {
      await run(appointmentId, "completion", (signal) =>
        commandRepository.changeAppointmentCompletion(
          appointmentId,
          isDone,
          signal,
        ),
      );
    },
    closeMenu: () => setOpenMenuAppointmentId(null),
    async confirmDelete() {
      if (!deletionConfirmation) {
        return;
      }

      const didDelete = await run(
        deletionConfirmation.appointmentId,
        "delete",
        (signal) =>
          commandRepository.deleteAppointment(
            deletionConfirmation.appointmentId,
            signal,
          ),
      );
      if (didDelete) {
        setDeletionConfirmation(null);
      }
    },
    deletionConfirmation: isCurrentContext ? deletionConfirmation : null,
    editing: {
      canSubmit:
        isCurrentContext &&
        audience === "authenticated" &&
        checklistItemId !== null,
      cancel: () => {
        if (inFlightRef.current) return;
        if (
          confirmDiscard &&
          Object.keys(initialDraft).some(
            (key) =>
              draft[key as keyof typeof draft] !==
              initialDraft[key as keyof typeof draft],
          )
        )
          setDiscardDialogOpen(true);
        else closeEditing();
      },
      isDiscardDialogOpen:
        isCurrentContext &&
        editingAppointmentId !== null &&
        isDiscardDialogOpen,
      cancelDiscard: () => setDiscardDialogOpen(false),
      confirmDiscard: () => {
        if (!inFlightRef.current) closeEditing();
      },
      ...draftFields,
      draft,
      errors,
      isOpen: isCurrentContext && editingAppointmentId !== null,
      submissionState: editingSubmissionState,
      submit: async () => {
        if (
          editingAppointmentId === null ||
          checklistItemId === null ||
          inFlightRef.current
        ) {
          return null;
        }

        const nextErrors = validateAppointmentDraft(draft);
        setErrors(nextErrors);
        const firstError = getFirstAppointmentErrorField(nextErrors);
        if (firstError) {
          return firstError;
        }

        const didUpdate = await run(editingAppointmentId, "update", (signal) =>
          commandRepository.updateAppointment(
            editingAppointmentId,
            checklistItemId,
            {
              date: draft.date,
              endTime: toLocalDateTime(draft.date, draft.endTime) ?? null,
              memo: toOptionalAppointmentText(draft.memo) ?? null,
              place: toOptionalAppointmentText(draft.place) ?? null,
              startTime: toLocalDateTime(draft.date, draft.startTime) ?? null,
              title: draft.title.trim(),
            },
            signal,
          ),
        );

        if (didUpdate) {
          setEditingAppointmentId(null);
          setDraft(emptyAppointmentDraft);
          setErrors({});
        }
        return null;
      },
    },
    editingAppointmentId: isCurrentContext ? editingAppointmentId : null,
    openMenuAppointmentId: isCurrentContext ? openMenuAppointmentId : null,
    operationFeedback,
    requestDelete: (appointmentId) => {
      if (!inFlightRef.current) {
        setOpenMenuAppointmentId(null);
        setDeletionConfirmation({ appointmentId });
        setOperationFeedback({ status: "idle" });
      }
    },
    startEditing: (appointment) => {
      if (!inFlightRef.current) {
        setOpenMenuAppointmentId(null);
        setEditingAppointmentId(appointment.id);
        setDraft(createDraft(appointment));
        setInitialDraft(createDraft(appointment));
        setDiscardDialogOpen(false);
        setErrors({});
        setOperationFeedback({ status: "idle" });
      }
    },
    toggleMenu: (appointmentId) => {
      if (!inFlightRef.current) {
        setOpenMenuAppointmentId((current) =>
          current === appointmentId ? null : appointmentId,
        );
        setOperationFeedback({ status: "idle" });
      }
    },
  };
}
