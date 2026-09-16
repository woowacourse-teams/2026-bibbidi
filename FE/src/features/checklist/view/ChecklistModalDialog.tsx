import { ReactNode, useEffect, useId, useRef } from "react";

import "./ChecklistModalDialog.css";
import { containTabFocus, focusFirstElement } from "./containTabFocus";

interface ChecklistModalDialogProps {
  actions: ReactNode;
  description: ReactNode;
  onEscape?: () => void;
  title: string;
  variant?: "default" | "critical";
}

export function ChecklistModalDialog({
  actions,
  description,
  onEscape,
  title,
  variant = "default",
}: ChecklistModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const titleId = `checklist-dialog-title-${reactId}`;
  const descriptionId = `checklist-dialog-description-${reactId}`;

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (dialogRef.current) {
      focusFirstElement(dialogRef.current);
    }

    return () => {
      if (previouslyFocused?.isConnected) {
        queueMicrotask(() => {
          if (previouslyFocused.isConnected) {
            previouslyFocused.focus();
          }
        });
      }
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
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

    dialog.addEventListener("keydown", handleKeyDown);

    return () => dialog.removeEventListener("keydown", handleKeyDown);
  }, [onEscape]);

  return (
    <div className="checklist-dialog__backdrop">
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
