import { ReactNode, useEffect, useId, useRef } from "react";
import type { RefObject } from "react";
import { useReturnFocus } from "../../../shared/focus/useReturnFocus";

import "./ChecklistModalDialog.css";
import {
  containTabFocus,
  focusFirstElement,
} from "../../../shared/focus/containTabFocus";

interface ChecklistModalDialogProps {
  actions: ReactNode;
  description: ReactNode;
  onBackdropPress?: () => void;
  onEscape?: () => void;
  title: string;
  variant?: "default" | "critical";
  returnFocusRef?: RefObject<HTMLElement | null>;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}

export function ChecklistModalDialog({
  actions,
  description,
  onBackdropPress,
  onEscape,
  title,
  variant = "default",
  returnFocusRef,
  fallbackFocusRef,
}: ChecklistModalDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const titleId = `checklist-dialog-title-${reactId}`;
  const descriptionId = `checklist-dialog-description-${reactId}`;

  useReturnFocus(dialogRef, returnFocusRef, fallbackFocusRef);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) {
      focusFirstElement(dialog);
    }
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
