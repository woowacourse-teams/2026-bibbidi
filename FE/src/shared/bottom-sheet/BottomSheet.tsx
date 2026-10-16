import { ReactNode } from "react";

import { useBottomSheetDismiss } from "./useBottomSheetDismiss";

export function BottomSheet({
  canDismiss = true,
  children,
  className,
  closeLabel,
  id,
  onClose,
  showCloseButton = false,
  title,
  titleId,
}: {
  canDismiss?: boolean;
  children: ReactNode | ((requestClose: () => void) => ReactNode);
  className: string;
  closeLabel: string;
  id?: string;
  onClose: () => void;
  showCloseButton?: boolean;
  title: ReactNode;
  titleId: string;
}) {
  const {
    dialogRef,
    finishDrag,
    handleDragKeyDown,
    handleDragMove,
    handleDragStart,
    handleRef,
    handleTransitionEnd,
    isClosing,
    isDragging,
    requestDismiss,
    rootStyle,
  } = useBottomSheetDismiss({ canDismiss, onDismiss: onClose });

  return (
    <div
      className={`${className} bottom-sheet-dismiss${
        isDragging ? " bottom-sheet-dismiss--dragging" : ""
      }${isClosing ? " bottom-sheet-dismiss--closing" : ""}`}
      style={rootStyle}
    >
      <button
        aria-label={closeLabel}
        className={`${className}__scrim bottom-sheet-dismiss__scrim`}
        disabled={!canDismiss}
        onClick={requestDismiss}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`${className}__dialog bottom-sheet-dismiss__dialog`}
        id={id}
        onTransitionEnd={handleTransitionEnd}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label={`아래로 밀어 ${closeLabel}`}
          className={`${className}__handle-area bottom-sheet-dismiss__handle-area`}
          disabled={!canDismiss}
          onKeyDown={handleDragKeyDown}
          onPointerCancel={finishDrag}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={finishDrag}
          ref={handleRef}
          type="button"
        >
          <span
            aria-hidden="true"
            className={`${className}__handle bottom-sheet-dismiss__handle`}
          />
        </button>
        <header className={`${className}__header`}>
          {typeof title === "string" ? <h2 id={titleId}>{title}</h2> : title}
          {showCloseButton ? (
            <button
              aria-label={closeLabel}
              disabled={!canDismiss}
              onClick={requestDismiss}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
        </header>
        {typeof children === "function" ? children(requestDismiss) : children}
      </section>
    </div>
  );
}
