import type { ChecklistAppointmentCreationController } from "../useChecklistAppointmentCreation";
import type { ChecklistAppointmentEditingController } from "../useChecklistAppointmentManagement";
import { AppointmentForm } from "./AppointmentForm";
import { ChecklistDiscardDialog } from "./ChecklistDiscardDialog";

export function ChecklistAppointmentForm({
  modal = false,
  controller,
  heading = "일정 추가",
  taskTitle,
}: {
  modal?: boolean;
  controller:
    | ChecklistAppointmentCreationController
    | ChecklistAppointmentEditingController;
  heading?: "일정 수정" | "일정 추가";
  taskTitle: string;
}) {
  return (
    <>
      <AppointmentForm
        controller={controller}
        taskTitle={taskTitle}
        heading={heading}
        modal={modal}
        blocked={controller.isDiscardDialogOpen}
        backLabel="할 일 상세로 돌아가기"
        idPrefix="checklist-appointment-creation"
      />
      {controller.isDiscardDialogOpen && (
        <ChecklistDiscardDialog
          onContinue={controller.cancelDiscard}
          onDiscard={controller.confirmDiscard}
          description={
            "변경한 일정 내용이 저장되지 않아요.\n닫은 뒤에는 작성 내용을 복구할 수 없어요."
          }
        />
      )}
    </>
  );
}
