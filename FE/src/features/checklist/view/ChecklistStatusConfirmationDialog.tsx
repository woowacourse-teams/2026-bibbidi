import { Dialog } from "../../../components/dialog";

export function ChecklistStatusConfirmationDialog({
  isPending,
  errorMessage,
  onCancel,
  onConfirm,
}: {
  isPending: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Confirm
      open
      title={<Dialog.Title>남은 일정도 완료할까요?</Dialog.Title>}
      description={
        <Dialog.Description>
          이 할 일을 완료하면 아직 남아 있는 일정도 함께 완료돼요.
        </Dialog.Description>
      }
      onClose={onCancel}
      closeOnEscape={!isPending}
      closeOnDimmerClick={false}
      cancelButton={
        <Dialog.Confirm.CancelButton disabled={isPending} onClick={onCancel}>
          취소
        </Dialog.Confirm.CancelButton>
      }
      confirmButton={
        <Dialog.Confirm.ConfirmButton disabled={isPending} onClick={onConfirm}>
          {isPending ? "변경 중" : "함께 완료"}
        </Dialog.Confirm.ConfirmButton>
      }
    >
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
    </Dialog.Confirm>
  );
}
