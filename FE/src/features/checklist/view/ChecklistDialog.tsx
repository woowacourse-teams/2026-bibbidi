import type { ReactNode, RefObject } from "react";
import { Dialog } from "../../../components/dialog";
import "./ChecklistDialog.css";

export function ChecklistDialog({
  actions,
  description,
  title,
  onEscape,
  onBackdropPress,
  returnFocusRef,
  fallbackFocusRef,
}: {
  actions: ReactNode;
  description: ReactNode;
  title: string;
  onEscape?: () => void;
  onBackdropPress?: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog
      className="checklist-confirmation"
      open
      title={<Dialog.Title>{title}</Dialog.Title>}
      description={
        <div className="bibbidi-dialog-description">{description}</div>
      }
      actions={actions}
      returnFocusRef={returnFocusRef}
      fallbackFocusRef={fallbackFocusRef}
      onClose={() => {}}
      closeOnEscape={!!onEscape}
      closeOnDimmerClick={!!onBackdropPress}
      onEscape={onEscape}
      onDimmerClick={onBackdropPress}
    />
  );
}
