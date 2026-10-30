import { useEffect, useRef } from "react";
import { canFocus } from "../../shared/focus/canFocus";

/** Restore checklist controls after their detail, form, or dialog closes. */
export function useChecklistFocusRestoration({
  selectedTaskId,
  activeTaskId,
  foregroundPresent,
  isAppointmentCreationOpen,
  isAppointmentEditingOpen,
  editingAppointmentId,
  deletionAppointmentId,
}: {
  selectedTaskId: string | null;
  activeTaskId: string | null;
  foregroundPresent: boolean;
  isAppointmentCreationOpen: boolean;
  isAppointmentEditingOpen: boolean;
  editingAppointmentId: number | null;
  deletionAppointmentId: number | null;
}) {
  const fallbackFocusRef = useRef<HTMLButtonElement>(null);
  const addTaskButtonRef = useRef<HTMLButtonElement>(null);
  const taskCreationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const wasAppointmentCreationOpenRef = useRef(isAppointmentCreationOpen);
  const appointmentCreationTaskIdRef = useRef(
    isAppointmentCreationOpen ? selectedTaskId : null,
  );
  const wasAppointmentEditingOpenRef = useRef(isAppointmentEditingOpen);
  const appointmentEditingIdRef = useRef<number | null>(null);
  const wasDeletionOpenRef = useRef(deletionAppointmentId !== null);
  const deletionAppointmentIdRef = useRef<number | null>(null);
  const previousSelectedTaskIdRef = useRef(selectedTaskId);
  const categoryChangeClosingDetailRef = useRef(false);
  const selectedTaskButtonRef = useRef<HTMLButtonElement | null>(null);
  const taskButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const previousSelectedTaskId = previousSelectedTaskIdRef.current;
    if (previousSelectedTaskId !== null && selectedTaskId === null) {
      if (foregroundPresent) return;
      const previousTaskButton =
        taskButtonRefs.current.get(previousSelectedTaskId) ??
        selectedTaskButtonRef.current;
      if (categoryChangeClosingDetailRef.current) {
        categoryChangeClosingDetailRef.current = false;
      } else if (canFocus(previousTaskButton)) {
        previousTaskButton.focus({ preventScroll: true });
      } else {
        (fallbackFocusRef.current ?? addTaskButtonRef.current)?.focus({
          preventScroll: true,
        });
      }
    }
    selectedTaskButtonRef.current = activeTaskId
      ? (taskButtonRefs.current.get(activeTaskId) ?? null)
      : null;
    previousSelectedTaskIdRef.current = selectedTaskId;
  }, [foregroundPresent, activeTaskId, selectedTaskId]);

  useEffect(() => {
    if (
      !wasAppointmentCreationOpenRef.current &&
      isAppointmentCreationOpen &&
      activeTaskId
    ) {
      appointmentCreationTaskIdRef.current = activeTaskId;
    }
    if (
      wasAppointmentCreationOpenRef.current &&
      !isAppointmentCreationOpen &&
      activeTaskId === appointmentCreationTaskIdRef.current &&
      activeTaskId
    ) {
      document
        .getElementById(`${activeTaskId}-add-appointment`)
        ?.focus({ preventScroll: true });
    }
    if (!isAppointmentCreationOpen) {
      appointmentCreationTaskIdRef.current = null;
    }
    wasAppointmentCreationOpenRef.current = isAppointmentCreationOpen;
  }, [isAppointmentCreationOpen, activeTaskId]);

  useEffect(() => {
    if (
      !wasAppointmentEditingOpenRef.current &&
      isAppointmentEditingOpen &&
      activeTaskId
    ) {
      appointmentEditingIdRef.current = editingAppointmentId;
    }
    if (wasAppointmentEditingOpenRef.current && !isAppointmentEditingOpen) {
      const appointmentId = appointmentEditingIdRef.current;
      if (appointmentId !== null) {
        document
          .getElementById(`${appointmentId}-appointment-menu-button`)
          ?.focus({ preventScroll: true });
      }
    }
    if (!isAppointmentEditingOpen) appointmentEditingIdRef.current = null;
    wasAppointmentEditingOpenRef.current = isAppointmentEditingOpen;
  }, [editingAppointmentId, isAppointmentEditingOpen, activeTaskId]);

  useEffect(() => {
    if (!wasDeletionOpenRef.current && deletionAppointmentId !== null) {
      deletionAppointmentIdRef.current = deletionAppointmentId;
    }
    if (wasDeletionOpenRef.current && deletionAppointmentId === null) {
      const trigger =
        deletionAppointmentIdRef.current === null
          ? null
          : document.getElementById(
              `${deletionAppointmentIdRef.current}-appointment-menu-button`,
            );
      (
        trigger ?? document.getElementById(`${activeTaskId}-add-appointment`)
      )?.focus({ preventScroll: true });
      deletionAppointmentIdRef.current = null;
    }
    wasDeletionOpenRef.current = deletionAppointmentId !== null;
  }, [deletionAppointmentId, activeTaskId]);

  return {
    fallbackFocusRef,
    addTaskButtonRef,
    taskCreationTriggerRef,
    registerTaskButton(taskId: string, button: HTMLButtonElement | null) {
      if (button) taskButtonRefs.current.set(taskId, button);
      else taskButtonRefs.current.delete(taskId);
    },
    rememberTaskSelection(button: HTMLButtonElement) {
      categoryChangeClosingDetailRef.current = false;
      selectedTaskButtonRef.current = button;
    },
    skipTaskFocusRestoration() {
      categoryChangeClosingDetailRef.current = selectedTaskId !== null;
    },
  };
}
