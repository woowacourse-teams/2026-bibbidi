import { ChecklistModalDialog } from "./ChecklistModalDialog";

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
    <ChecklistModalDialog
      title="남은 일정도 완료할까요?"
      description={
        <>
          이 할 일을 완료하면 아직 남아 있는 일정도 함께 완료돼요.
          {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        </>
      }
      onEscape={() => {
        if (!isPending) onCancel();
      }}
      actions={
        <>
          <button type="button" disabled={isPending} onClick={onCancel}>
            취소
          </button>
          <button type="button" disabled={isPending} onClick={onConfirm}>
            {isPending ? "변경 중" : "함께 완료"}
          </button>
        </>
      }
    />
  );
}
