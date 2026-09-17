import { ReactNode, useEffect, useId, useRef } from "react";

import "./ChecklistModalDialog.css";
import { containTabFocus, focusFirstElement } from "./containTabFocus";

interface ChecklistModalDialogProps {
  actions: ReactNode;
  description: ReactNode;
  onBackdropPress?: () => void;
  onEscape?: () => void;
  title: string;
  variant?: "default" | "critical";
}

export function ChecklistModalDialog({
  actions,
  description,
  onBackdropPress,
  onEscape,
  title,
  variant = "default",
}: ChecklistModalDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const titleId = `checklist-dialog-title-${reactId}`;
  const descriptionId = `checklist-dialog-description-${reactId}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (dialog) {
      focusFirstElement(dialog);
    }

    return () => {
      if (previouslyFocused?.isConnected) {
        queueMicrotask(() => {
          if (!dialog?.isConnected && previouslyFocused.isConnected) {
            previouslyFocused.focus();
          }
        });
      }
    };
  }, []);

  useEffect(() => {
    const backdrop = backdropRef.current;
    const dialog = dialogRef.current;

    if (!backdrop || !dialog) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && onEscape) {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
      }

      containTabFocus(event, dialog);
    };
    const handleBackdropMouseDown = (event: globalThis.MouseEvent) => {
      if (event.target === backdrop) {
        onBackdropPress?.();
      }
    };

    dialog.addEventListener("keydown", handleKeyDown);
    backdrop.addEventListener("mousedown", handleBackdropMouseDown);

    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
      backdrop.removeEventListener("mousedown", handleBackdropMouseDown);
    };
  }, [onBackdropPress, onEscape]);

  return (
    <div className="checklist-dialog__backdrop" ref={backdropRef}>
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`checklist-dialog checklist-dialog--${variant}`}
        ref={dialogRef}
        role="dialog"
      >
        <div className="checklist-dialog__header">
          <h2 id={titleId}>{title}</h2>
          <div className="checklist-dialog__description" id={descriptionId}>
            {description}
          </div>
        </div>
        <div className="checklist-dialog__actions">{actions}</div>
      </div>
    </div>
  );
}
