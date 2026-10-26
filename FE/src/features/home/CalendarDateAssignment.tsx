import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { PanelOverlay } from "../../components/panel-overlay";
import { useIsMobileLayout } from "../../shared/responsive";
import { usePageScrollContainer } from "../../shared/scroll/usePageScrollContainer";

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
import { CalendarAppointmentForm } from "./view/CalendarAppointmentForm";

export function CalendarDateAssignment({
  itemId,
  title,
  onClose,
  onSaved,
  fallbackFocusRef,
}: {
  itemId: number;
  title: string;
  onClose: () => void;
  onSaved: (date: string) => void;
  fallbackFocusRef: RefObject<HTMLElement | null>;
}) {
  const { authState, refreshAuth } = useAuth();
  const command = useMyChecklistCommandRepository();
  const query = useMyChecklistQueryRepository();
  const savedDate = useRef<string>("");
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }, []);
  const mobile = useIsMobileLayout();
  const { ref, environment } = usePageScrollContainer();
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
  useEffect(() => {
    if (!started.current && controller.canOpen) {
      started.current = true;
      controller.open("calendar");
      controller.changeTitle(title);
    }
  }, [controller, title]);
  const pending = controller.submissionState.status === "submitting";
  return (
    <div ref={ref}>
      {environment && (
        <PanelOverlay
          open={controller.isOpen}
          onClose={controller.cancel}
          onExited={onClose}
          placement={mobile ? "fullscreen" : "side"}
          aria-label={`${title} 일정 추가`}
          scrollContainer={environment.scrollContainer}
          returnFocusRef={returnFocusRef}
          fallbackFocusRef={fallbackFocusRef}
          closeOnEscape={!pending}
          closeOnDimmerClick={false}
        >
          <CalendarAppointmentForm
            open={controller.isOpen}
            controller={controller}
            taskTitle={title}
          />
        </PanelOverlay>
      )}
    </div>
  );
}
