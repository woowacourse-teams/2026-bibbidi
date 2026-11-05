import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "../auth";
import {
  MyChecklistAuthenticationRequiredError,
  useMyChecklistCommandRepository,
  useMyChecklistQueryRepository,
} from "../checklist";
import { AppointmentCreationError } from "../checklist/model/appointmentCreation";
import {
  ChecklistAppointmentCreationInput,
  useChecklistAppointmentCreation,
} from "../checklist/useChecklistAppointmentCreation";
import { ChecklistAppointmentCreation } from "../checklist/view/ChecklistAppointmentCreation";

export function CalendarDateAssignment({
  itemId,
  title,
  onClose,
  onSaved,
}: {
  itemId: number;
  title: string;
  onClose: () => void;
  onSaved: (date: string) => void;
}) {
  const { authState, refreshAuth } = useAuth();
  const command = useMyChecklistCommandRepository();
  const query = useMyChecklistQueryRepository();
  const savedDate = useRef<string>("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const completeRefresh = useCallback(
    async (signal: AbortSignal) => {
      try {
        await query.getChecklist(signal);
        if (!signal.aborted) onSaved(savedDate.current);
      } catch (error) {
        if (error instanceof MyChecklistAuthenticationRequiredError)
          refreshAuth();
        throw new AppointmentCreationError("refresh-failed", { cause: error });
      }
    },
    [query, onSaved, refreshAuth],
  );
  const submit = useCallback(
    async (input: ChecklistAppointmentCreationInput, signal: AbortSignal) => {
      try {
        await command.createAppointment(
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
        if (error instanceof MyChecklistAuthenticationRequiredError)
          refreshAuth();
        throw error;
      }
      savedDate.current = input.date;
      query.invalidate();
      await completeRefresh(signal);
    },
    [command, query, completeRefresh, refreshAuth],
  );
  const controller = useChecklistAppointmentCreation({
    checklistItemId: itemId,
    isAuthenticated: authState.status === "authenticated",
    sessionIdentity:
      authState.status === "authenticated"
        ? String(authState.user.id)
        : undefined,
    onSubmit: submit,
    onRetryRefresh: completeRefresh,
  });
  const started = useRef(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!started.current && controller.canOpen) {
      started.current = true;
      controller.open("calendar");
      controller.changeTitle(title);
      dialogRef.current?.showModal();
    }
    if (controller.isOpen) wasOpen.current = true;
    else if (wasOpen.current) {
      dialogRef.current?.close();
      onClose();
    }
  }, [controller, title, onClose]);
  return (
    <dialog
      className="calendar-planning__date-dialog"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        controller.cancel();
      }}
      aria-label={`${title} 일정 추가`}
    >
      <ChecklistAppointmentCreation
        controller={controller}
        taskTitle={title}
        embedded
      />
    </dialog>
  );
}
