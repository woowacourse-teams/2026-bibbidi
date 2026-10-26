import { useExitSnapshot } from "../../../shared/modal/useLayerPresence";
import type { ChecklistAppointmentFormController } from "../../checklist/model/appointmentForm";
import { AppointmentForm } from "../../checklist/view/AppointmentForm";

export function CalendarAppointmentForm({
  open,
  controller,
  taskTitle,
}: {
  open: boolean;
  controller: ChecklistAppointmentFormController;
  taskTitle: string;
}) {
  const displayController = useExitSnapshot(open, controller) ?? controller;
  return (
    <AppointmentForm
      controller={displayController}
      taskTitle={taskTitle}
      modal
      backLabel="캘린더로 돌아가기"
      idPrefix="calendar-appointment-creation"
    />
  );
}
