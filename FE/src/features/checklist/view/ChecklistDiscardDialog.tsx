import { Dialog } from "../../../components/dialog";

export function ChecklistDiscardDialog({
  onContinue,
  onDiscard,
  description,
}: {
  onContinue: () => void;
  onDiscard: () => void;
  description: string;
}) {
  return (
    <Dialog.Confirm
      open
      onClose={onContinue}
      closeOnDimmerClick={false}
      title={<Dialog.Title>작성 중인 내용을 닫을까요?</Dialog.Title>}
      description={<Dialog.Description>{description}</Dialog.Description>}
      cancelButton={
        <Dialog.Confirm.CancelButton onClick={onContinue}>
          계속 작성
        </Dialog.Confirm.CancelButton>
      }
      confirmButton={
        <Dialog.Confirm.ConfirmButton color="danger" onClick={onDiscard}>
          나가기
        </Dialog.Confirm.ConfirmButton>
      }
    />
  );
}
