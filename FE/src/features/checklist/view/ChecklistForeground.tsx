import { useRef } from "react";
import type { ReactNode } from "react";
import { useModalEnvironment } from "../../../shared/modal/useModalEnvironment";

export function ChecklistForeground({
  children,
  modal,
  overlay,
  blocked,
  onClose,
  onEscape,
  restoreFocus = true,
}: {
  children: ReactNode;
  modal: boolean;
  overlay: boolean;
  blocked: boolean;
  onClose: () => void;
  onEscape?: () => void;
  restoreFocus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalEnvironment({
    active: modal,
    rootRef: ref,
    blocked,
    onEscape,
    inertBackground: true,
    restoreOnlyOnUnmount: true,
    restoreFocus,
  });
  return (
    <div
      className="checklist-workspace__foreground-layer"
      data-overlay={overlay || undefined}
      ref={ref}
    >
      {overlay && (
        <button
          className="checklist-workspace__scrim"
          type="button"
          tabIndex={-1}
          aria-label="패널 닫기"
          disabled={blocked}
          onClick={onClose}
        />
      )}
      <div className="checklist-workspace__panel">{children}</div>
    </div>
  );
}
