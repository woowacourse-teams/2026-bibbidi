import { useEffect, useId, useRef } from "react";

import "./LoginRequiredDialog.css";

interface LoginRequiredDialogProps {
  onClose: () => void;
  onLogin: () => void;
  returnFocusTo: HTMLElement | null;
}

const focusableSelector = [
  "button",
  "[href]",
  "input",
  "select",
  "textarea",
  "[tabindex]",
].join(",");

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter((element) => !element.matches(":disabled") && element.tabIndex >= 0);
}

export function LoginRequiredDialog({
  onClose,
  onLogin,
  returnFocusTo,
}: LoginRequiredDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) {
      getFocusableElements(dialog)[0]?.focus();
    }

    return () => {
      if (returnFocusTo?.isConnected) {
        queueMicrotask(() => {
          if (!dialog?.isConnected && returnFocusTo.isConnected) {
            returnFocusTo.focus();
          }
        });
      }
    };
  }, [returnFocusTo]);

  useEffect(() => {
    const backdrop = backdropRef.current;
    const dialog = dialogRef.current;

    if (!backdrop || !dialog) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(dialog);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    const handleBackdropMouseDown = (event: globalThis.MouseEvent) => {
      if (event.target === backdrop) {
        onClose();
      }
    };

    dialog.addEventListener("keydown", handleKeyDown);
    backdrop.addEventListener("mousedown", handleBackdropMouseDown);

    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
      backdrop.removeEventListener("mousedown", handleBackdropMouseDown);
    };
  }, [onClose]);

  return (
    <div className="login-required-dialog__backdrop" ref={backdropRef}>
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="login-required-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <div className="login-required-dialog__header">
          <h2 id={titleId}>로그인이 필요해요</h2>
          <p id={descriptionId}>
            플래너를 이용하려면 로그인이 필요해요.
            {"\n"}
            로그인하고 나만의 일정과 준비 현황을 확인해 보세요.
          </p>
        </div>

        <div className="login-required-dialog__actions">
          <button onClick={onClose} type="button">
            취소
          </button>
          <button onClick={onLogin} type="button">
            로그인
          </button>
        </div>
      </div>
    </div>
  );
}
