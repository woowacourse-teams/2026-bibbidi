import { Button } from "../../../components/button";
import { ChecklistDialog } from "./ChecklistDialog";

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
    <ChecklistDialog
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
          <Button
            size="large"
            color="dark"
            variant="weak"
            type="button"
            disabled={isPending}
            onClick={onCancel}
          >
            취소
          </Button>
          <Button
            size="large"
            type="button"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? "변경 중" : "함께 완료"}
          </Button>
        </>
      }
    />
  );
}
