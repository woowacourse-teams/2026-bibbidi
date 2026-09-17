import {
  CSSProperties,
  KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistItemStatus } from "../model/myChecklist";
import { ChecklistTaskViewModel } from "../view-model/createChecklistViewModel";
import { getChecklistPopoverStyle } from "./getChecklistPopoverStyle";
import "./ChecklistTaskStatusEditor.css";

interface ChecklistTaskStatusEditorProps {
  editing?: ChecklistItemEditingController;
  task: ChecklistTaskViewModel;
}

const statusOptions: readonly {
  label: string;
  status: ChecklistItemStatus;
}[] = [
  { label: "예정", status: "prev" },
  { label: "진행 중", status: "continue" },
  { label: "완료", status: "done" },
];

const POPOVER_GAP = 6;
const POPOVER_MARGIN = 12;
const POPOVER_WIDTH = 180;

function ChevronIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m8 10 4 4 4-4" />
    </svg>
  );
}

export function ChecklistTaskStatusEditor({
  editing,
  task,
}: ChecklistTaskStatusEditorProps) {
  const itemId = task.checklistItemId;
  const isOpen =
    itemId !== null && editing?.statusEditSession?.itemId === itemId;
  const isConfirmationOpen =
    itemId !== null && editing?.statusConfirmation?.itemId === itemId;
  const feedback = editing?.changeFeedback;
  const isSaving = feedback?.status === "pending";
  const isCurrentFeedback =
    itemId !== null &&
    feedback?.status !== "idle" &&
    feedback?.itemId === itemId &&
    feedback.kind === "status";
  const errorMessage =
    isCurrentFeedback && feedback.status === "error"
      ? feedback.errorMessage
      : undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef(new Map<ChecklistItemStatus, HTMLButtonElement>());
  const isSubmittingRef = useRef(false);
  const shouldRestoreFocusRef = useRef(false);
  const wasOpenRef = useRef(isOpen);
  const wasConfirmationOpenRef = useRef(isConfirmationOpen);
  const [activeStatus, setActiveStatus] = useState(task.checklistItemStatus);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>();
  const popoverId = `${task.id}-status-options`;
  const errorId = `${task.id}-status-error`;

  const close = useCallback(() => {
    if (itemId === null || !editing) {
      return;
    }

    shouldRestoreFocusRef.current = true;
    editing.finishStatusEditing(itemId);
    editing.clearError(itemId);
  }, [editing, itemId]);

  useEffect(() => {
    if (isOpen) {
      optionRefs.current.get(task.checklistItemStatus)?.focus();
    }
  }, [isOpen, task.checklistItemStatus]);

  const updatePopoverPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;

    if (!trigger || !popover) {
      return;
    }

    setPopoverStyle(
      getChecklistPopoverStyle(trigger, popover, {
        gap: POPOVER_GAP,
        margin: POPOVER_MARGIN,
        maxWidth: POPOVER_WIDTH,
      }),
    );
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [errorMessage, isOpen, updatePopoverPosition]);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen && shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false;
      triggerRef.current?.focus();
    }

    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (wasConfirmationOpenRef.current && !isConfirmationOpen) {
      triggerRef.current?.focus();
    }

    wasConfirmationOpenRef.current = isConfirmationOpen;
  }, [isConfirmationOpen]);

  useEffect(() => {
    if (!isOpen || isSaving) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        close();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [close, isOpen, isSaving]);

  if (!task.isStatusEditable || itemId === null || !editing) {
    return (
      <span
        className={`checklist-detail-content__task-status checklist-detail-content__task-status--${task.status}`}
      >
        {task.statusLabel}
      </span>
    );
  }

  const toggle = () => {
    if (isOpen) {
      close();
      return;
    }

    setActiveStatus(task.checklistItemStatus);
    editing.clearError(itemId);
    editing.startStatusEditing(itemId);
  };

  const selectStatus = async (status: ChecklistItemStatus) => {
    if (isSaving || isSubmittingRef.current) {
      return;
    }

    setActiveStatus(status);

    if (status === task.checklistItemStatus) {
      close();
      return;
    }

    isSubmittingRef.current = true;
    editing.clearError(itemId);

    try {
      const result = await editing.requestStatusChange(itemId, status);

      if (result === "changed") {
        shouldRestoreFocusRef.current = true;
        editing.finishStatusEditing(itemId);
      } else if (result === "confirmation-required") {
        shouldRestoreFocusRef.current = false;
        editing.finishStatusEditing(itemId);
      }
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const focusOption = (
    event: KeyboardEvent<HTMLUListElement>,
    index: number,
  ) => {
    const option = statusOptions[index];

    if (!option) {
      return;
    }

    event.preventDefault();
    setActiveStatus(option.status);
    optionRefs.current.get(option.status)?.focus();
  };

  const focusRelativeOption = (
    event: KeyboardEvent<HTMLUListElement>,
    offset: number,
  ) => {
    const focusedIndex = statusOptions.findIndex(
      (option) =>
        optionRefs.current.get(option.status) === document.activeElement,
    );
    const currentIndex = Math.max(
      0,
      focusedIndex >= 0
        ? focusedIndex
        : statusOptions.findIndex(
            (option) => option.status === task.checklistItemStatus,
          ),
    );
    focusOption(
      event,
      (currentIndex + offset + statusOptions.length) % statusOptions.length,
    );
  };

  const handlePopoverKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();

      if (!isSaving) {
        close();
      }
    } else if (event.key === "ArrowDown") {
      focusRelativeOption(event, 1);
    } else if (event.key === "ArrowUp") {
      focusRelativeOption(event, -1);
    } else if (event.key === "Home") {
      focusOption(event, 0);
    } else if (event.key === "End") {
      focusOption(event, statusOptions.length - 1);
    }
  };

  return (
    <div className="checklist-status-editor" ref={rootRef}>
      <button
        aria-controls={isOpen ? popoverId : undefined}
        aria-describedby={errorMessage ? errorId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`상태 변경, 현재 ${task.statusLabel}`}
        className={`checklist-status-editor__trigger checklist-detail-content__task-status checklist-detail-content__task-status--${task.status}`}
        disabled={isSaving}
        onClick={toggle}
        ref={triggerRef}
        type="button"
      >
        <span>{task.statusLabel}</span>
        <ChevronIcon />
      </button>

      {isOpen ? (
        <div
          className="checklist-status-editor__popover"
          ref={popoverRef}
          style={popoverStyle}
        >
          <ul
            aria-busy={isSaving}
            aria-label="상태 선택"
            className="checklist-status-editor__options"
            id={popoverId}
            onKeyDown={handlePopoverKeyDown}
            role="listbox"
          >
            {statusOptions.map((option) => {
              const isSelected = option.status === task.checklistItemStatus;

              return (
                <li key={option.status} role="presentation">
                  <button
                    aria-selected={isSelected}
                    className="checklist-status-editor__option"
                    disabled={isSaving}
                    onClick={() => void selectStatus(option.status)}
                    onFocus={() => setActiveStatus(option.status)}
                    ref={(button) => {
                      if (button) {
                        optionRefs.current.set(option.status, button);
                      } else {
                        optionRefs.current.delete(option.status);
                      }
                    }}
                    role="option"
                    tabIndex={option.status === activeStatus ? 0 : -1}
                    type="button"
                  >
                    <span>{option.label}</span>
                    <span
                      aria-hidden="true"
                      className="checklist-status-editor__check"
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {errorMessage ? (
            <p
              className="checklist-status-editor__error"
              id={errorId}
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
