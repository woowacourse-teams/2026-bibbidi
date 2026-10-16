import { ReactNode, RefObject, useLayoutEffect, useRef } from "react";

import { containTabFocus } from "../../../shared/focus/containTabFocus";

export function MobileAiChatDialog({
  children,
  isOpen,
  onClose,
  returnFocusRef,
}: {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const programmaticCloses = useRef(0);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const launcher = returnFocusRef.current;
    const close = () => {
      if (!dialog.open) return;
      programmaticCloses.current += 1;
      dialog.close();
    };
    if (isOpen) {
      dialog.showModal();
    } else close();
    const handleKeyDown = (event: KeyboardEvent) =>
      containTabFocus(event, dialog);
    dialog.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
      close();
      if (isOpen) {
        queueMicrotask(() => {
          if (launcher?.isConnected && !dialog.open) launcher.focus();
        });
      }
    };
  }, [isOpen, returnFocusRef]);

  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const dialog = dialogRef.current;
    if (!viewport || !dialog || !isOpen) return;
    const resize = () => {
      dialog.style.height = `${viewport.height}px`;
      dialog.style.top = `${viewport.offsetTop}px`;
    };
    resize();
    viewport.addEventListener("resize", resize);
    viewport.addEventListener("scroll", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      viewport.removeEventListener("scroll", resize);
    };
  }, [isOpen]);

  return (
    <dialog
      aria-label="AI 채팅"
      className="ai-chat-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={(event) => {
        if (programmaticCloses.current > 0) {
          programmaticCloses.current -= 1;
          return;
        }
        if (isOpen && !event.currentTarget.open) onClose();
      }}
      ref={dialogRef}
    >
      <header className="ai-chat-dialog__header">
        <button
          aria-label="로드맵으로 돌아가기"
          onClick={onClose}
          type="button"
        >
          ‹
        </button>
        <h2>AI 채팅</h2>
        <button aria-label="AI 채팅 닫기" onClick={onClose} type="button">
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
