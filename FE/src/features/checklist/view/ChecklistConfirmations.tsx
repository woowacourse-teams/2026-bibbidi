import type { RefObject } from "react";
import { Dialog } from "../../../components/dialog";
import type {
  ChecklistConfirmationViewModel,
  ChecklistDeletionConfirmationViewModel,
} from "../view-model/createChecklistConfirmationViewModel";
import { ChecklistStatusConfirmationDialog } from "./ChecklistStatusConfirmationDialog";

function ChecklistDeletionConfirmationDialog({
  target,
  isPending,
  errorMessage,
  onCancel,
  onConfirm,
}: ChecklistDeletionConfirmationViewModel) {
  return (
    <Dialog.Confirm
      open
      title={
        <Dialog.Title>
          {target === "task"
            ? "이 할 일을 삭제할까요?"
            : "이 일정을 삭제할까요?"}
        </Dialog.Title>
      }
      description={
        <Dialog.Description>
          {target === "task"
            ? "삭제한 할 일과 연결된 일정은 다시 복구할 수 없어요."
            : "삭제한 일정은 다시 복구할 수 없어요."}
        </Dialog.Description>
      }
      onClose={onCancel}
      closeOnDimmerClick={!isPending}
      closeOnEscape={!isPending}
      cancelButton={
        <Dialog.Confirm.CancelButton disabled={isPending} onClick={onCancel}>
          취소
        </Dialog.Confirm.CancelButton>
      }
      confirmButton={
        <Dialog.Confirm.ConfirmButton
          color="danger"
          aria-busy={isPending}
          disabled={isPending}
          onClick={onConfirm}
        >
          {isPending ? "삭제 중" : "삭제"}
        </Dialog.Confirm.ConfirmButton>
      }
    >
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
    </Dialog.Confirm>
  );
}

export function ChecklistConfirmations({
  confirmations,
  loginRequiredReason,
  onCancelLoginRequired,
  onVisitLogin,
  taskCreationTriggerRef,
  fallbackFocusRef,
}: {
  confirmations: ChecklistConfirmationViewModel;
  loginRequiredReason: "schedule-creation" | "task-creation" | null;
  onCancelLoginRequired?: () => void;
  onVisitLogin?: () => void;
  taskCreationTriggerRef: RefObject<HTMLElement | null>;
  fallbackFocusRef: RefObject<HTMLElement | null>;
}) {
  return (
    <>
      {loginRequiredReason !== null ? (
        <Dialog.Confirm
          open
          title={<Dialog.Title>로그인이 필요해요</Dialog.Title>}
          description={
            <Dialog.Description>
              {loginRequiredReason === "schedule-creation"
                ? "일정을 추가하려면 로그인해 주세요.\n로그인 후 체크리스트에서 계속할 수 있어요."
                : "나만의 할 일을 추가하려면 로그인해 주세요.\n로그인 후 체크리스트에서 계속할 수 있어요."}
            </Dialog.Description>
          }
          onClose={() => onCancelLoginRequired?.()}
          closeOnDimmerClick={!!onCancelLoginRequired}
          closeOnEscape={!!onCancelLoginRequired}
          returnFocusRef={
            loginRequiredReason === "task-creation"
              ? taskCreationTriggerRef
              : undefined
          }
          fallbackFocusRef={fallbackFocusRef}
          cancelButton={
            <Dialog.Confirm.CancelButton onClick={onCancelLoginRequired}>
              취소
            </Dialog.Confirm.CancelButton>
          }
          confirmButton={
            <Dialog.Confirm.ConfirmButton onClick={onVisitLogin}>
              로그인
            </Dialog.Confirm.ConfirmButton>
          }
        />
      ) : null}
      {confirmations.statusChange ? (
        <ChecklistStatusConfirmationDialog {...confirmations.statusChange} />
      ) : null}
      {confirmations.deletions.map((deletion) => (
        <ChecklistDeletionConfirmationDialog
          key={deletion.target}
          {...deletion}
        />
      ))}
    </>
  );
}
