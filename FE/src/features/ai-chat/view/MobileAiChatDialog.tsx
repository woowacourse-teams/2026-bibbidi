import { ReactNode, useEffect, useLayoutEffect, useRef } from "react";

import { containTabFocus } from "../../../shared/focus/containTabFocus";

export function MobileAiChatDialog({
  children,
  isOpen,
  onClose,
}: {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
    const handleKeyDown = (event: KeyboardEvent) =>
      containTabFocus(event, dialog);
    dialog.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
      if (dialog.open) dialog.close();
    };
  }, [isOpen]);

  useEffect(() => {
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
      onClose={onClose}
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
        <h2>
          AI 채팅 <span>예시</span>
        </h2>
        <button aria-label="AI 채팅 닫기" onClick={onClose} type="button">
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
