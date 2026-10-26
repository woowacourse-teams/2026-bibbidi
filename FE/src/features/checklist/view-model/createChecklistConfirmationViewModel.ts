import type {
  ChecklistItemChangeKind,
  ChecklistItemEditingController,
} from "../model/checklistEditing";
import type { ChecklistAppointmentManagementController } from "../useChecklistAppointmentManagement";

interface ConfirmationActions {
  isPending: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export interface ChecklistDeletionConfirmationViewModel extends ConfirmationActions {
  target: "task" | "appointment";
}

export interface ChecklistConfirmationViewModel {
  deletions: ChecklistDeletionConfirmationViewModel[];
  statusChange: ConfirmationActions | null;
}

export function createChecklistConfirmationViewModel({
  selectedItemId,
  itemEditing,
  appointmentManagement,
}: {
  selectedItemId: number | null;
  itemEditing?: ChecklistItemEditingController;
  appointmentManagement?: ChecklistAppointmentManagementController;
}): ChecklistConfirmationViewModel {
  const deletions: ChecklistDeletionConfirmationViewModel[] = [];
  const itemFeedback = (itemId: number, kind: ChecklistItemChangeKind) => {
    const feedback = itemEditing?.changeFeedback;
    const matches =
      feedback &&
      feedback.status !== "idle" &&
      feedback.itemId === itemId &&
      feedback.kind === kind;
    return {
      isPending: !!matches && feedback.status === "pending",
      errorMessage:
        matches && feedback.status === "error"
          ? feedback.errorMessage
          : undefined,
    };
  };

  if (appointmentManagement?.deletionConfirmation) {
    const { appointmentId } = appointmentManagement.deletionConfirmation;
    const feedback = appointmentManagement.operationFeedback;
    const matches =
      feedback.status !== "idle" &&
      feedback.appointmentId === appointmentId &&
      feedback.operation === "delete";
    deletions.push({
      target: "appointment",
      isPending: matches && feedback.status === "pending",
      errorMessage:
        matches && feedback.status === "error"
          ? feedback.errorMessage
          : undefined,
      onCancel: appointmentManagement.cancelDelete,
      onConfirm: () => void appointmentManagement.confirmDelete(),
    });
  }

  const cancelDelete = itemEditing?.cancelDelete;
  const confirmDelete = itemEditing?.confirmDelete;
  if (
    selectedItemId !== null &&
    itemEditing?.deletionConfirmation === selectedItemId &&
    cancelDelete &&
    confirmDelete
  ) {
    deletions.push({
      target: "task",
      ...itemFeedback(selectedItemId, "delete"),
      onCancel: cancelDelete,
      onConfirm: () => void confirmDelete(),
    });
  }

  const statusChange =
    selectedItemId !== null &&
    itemEditing?.statusConfirmation?.itemId === selectedItemId
      ? {
          ...itemFeedback(selectedItemId, "status"),
          onCancel: () => itemEditing.cancelStatusChange(selectedItemId),
          onConfirm: () => void itemEditing.confirmStatusChange(selectedItemId),
        }
      : null;

  return { deletions, statusChange };
}
