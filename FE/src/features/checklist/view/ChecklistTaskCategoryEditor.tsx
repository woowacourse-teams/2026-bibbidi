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
import {
  ChecklistCategoryViewModel,
  ChecklistTaskViewModel,
} from "../view-model/createChecklistViewModel";
import { getChecklistPopoverStyle } from "./getChecklistPopoverStyle";
import "./ChecklistTaskCategoryEditor.css";

interface ChecklistTaskCategoryEditorProps {
  categories: ChecklistCategoryViewModel[];
  categoryTitle: string;
  editing?: ChecklistItemEditingController;
  task: ChecklistTaskViewModel;
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m8 10 4 4 4-4" />
    </svg>
  );
}

const POPOVER_GAP = 6;
const POPOVER_MARGIN = 12;
const POPOVER_MAX_WIDTH = 240;

export function ChecklistTaskCategoryEditor({
  categories,
  categoryTitle,
  editing,
  task,
}: ChecklistTaskCategoryEditorProps) {
  const itemId = task.checklistItemId;
  const isOpen =
    itemId !== null && editing?.categoryEditSession?.itemId === itemId;
  const feedback = editing?.changeFeedback;
  const isSaving = feedback?.status === "pending";
  const isCurrentFeedback =
    itemId !== null &&
    feedback?.status !== "idle" &&
    feedback?.itemId === itemId &&
    feedback.kind === "category";
  const errorMessage =
    isCurrentFeedback && feedback.status === "error"
      ? feedback.errorMessage
      : undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const isSubmittingRef = useRef(false);
  const shouldRestoreFocusRef = useRef(false);
  const wasOpenRef = useRef(isOpen);
  const [activeCategoryId, setActiveCategoryId] = useState(task.categoryId);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>();
  const popoverId = `${task.id}-category-options`;
  const errorId = `${task.id}-category-error`;

  const close = useCallback(() => {
    if (itemId === null || !editing) {
      return;
    }

    shouldRestoreFocusRef.current = true;
    editing.finishCategoryEditing(itemId);
    editing.clearError(itemId);
  }, [editing, itemId]);

  useEffect(() => {
    if (isOpen) {
      optionRefs.current.get(task.categoryId)?.focus();
    }
  }, [isOpen, task.categoryId]);

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
        maxWidth: POPOVER_MAX_WIDTH,
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
  }, [categories.length, errorMessage, isOpen, updatePopoverPosition]);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen && shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false;
      triggerRef.current?.focus();
    }

    wasOpenRef.current = isOpen;
  }, [isOpen]);

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

  if (!task.isEditable || itemId === null || !editing) {
    return categoryTitle;
  }

  const open = () => {
    setActiveCategoryId(task.categoryId);
    editing.clearError(itemId);
    editing.startCategoryEditing(itemId);
  };

  const toggle = () => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  };

  const selectCategory = async (categoryId: string) => {
    if (isSaving || isSubmittingRef.current) {
      return;
    }

    setActiveCategoryId(categoryId);

    if (categoryId === task.categoryId) {
      close();
      return;
    }

    isSubmittingRef.current = true;
    editing.clearError(itemId);

    try {
      if (await editing.changeCategory(itemId, categoryId)) {
        shouldRestoreFocusRef.current = true;
        editing.finishCategoryEditing(itemId);
      }
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const focusRelativeOption = (
    event: KeyboardEvent<HTMLUListElement>,
    offset: number,
  ) => {
    const focusedIndex = categories.findIndex(
      (category) =>
        optionRefs.current.get(category.id) === document.activeElement,
    );
    const currentIndex = Math.max(
      0,
      focusedIndex >= 0
        ? focusedIndex
        : categories.findIndex((category) => category.id === task.categoryId),
    );
    const nextIndex =
      (currentIndex + offset + categories.length) % categories.length;
    const nextCategoryId = categories[nextIndex].id;

    event.preventDefault();
    setActiveCategoryId(nextCategoryId);
    optionRefs.current.get(nextCategoryId)?.focus();
  };

  const handlePopoverKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();

      if (!isSaving) {
        close();
      }

      return;
    }

    if (event.key === "ArrowDown") {
      focusRelativeOption(event, 1);
    } else if (event.key === "ArrowUp") {
      focusRelativeOption(event, -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      const firstCategoryId = categories[0]?.id;

      if (firstCategoryId) {
        setActiveCategoryId(firstCategoryId);
        optionRefs.current.get(firstCategoryId)?.focus();
      }
    } else if (event.key === "End") {
      event.preventDefault();
      const lastCategoryId = categories.at(-1)?.id;

      if (lastCategoryId) {
        setActiveCategoryId(lastCategoryId);
        optionRefs.current.get(lastCategoryId)?.focus();
      }
    }
  };

  return (
    <div className="checklist-category-editor" ref={rootRef}>
      <button
        aria-controls={isOpen ? popoverId : undefined}
        aria-describedby={errorMessage ? errorId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`카테고리 변경, 현재 ${categoryTitle}`}
        className="checklist-category-editor__trigger"
        disabled={isSaving}
        onClick={toggle}
        ref={triggerRef}
        type="button"
      >
        <span>{categoryTitle}</span>
        <ChevronIcon />
      </button>

      {isOpen ? (
        <div
          className="checklist-category-editor__popover"
          ref={popoverRef}
          style={popoverStyle}
        >
          <ul
            aria-busy={isSaving}
            aria-label="카테고리 선택"
            className="checklist-category-editor__options"
            id={popoverId}
            onKeyDown={handlePopoverKeyDown}
            role="listbox"
          >
            {categories.map((category) => {
              const isSelected = category.id === task.categoryId;

              return (
                <li key={category.id} role="presentation">
                  <button
                    aria-selected={isSelected}
                    className="checklist-category-editor__option"
                    disabled={isSaving}
                    onClick={() => void selectCategory(category.id)}
                    onFocus={() => setActiveCategoryId(category.id)}
                    ref={(button) => {
                      if (button) {
                        optionRefs.current.set(category.id, button);
                      } else {
                        optionRefs.current.delete(category.id);
                      }
                    }}
                    role="option"
                    tabIndex={category.id === activeCategoryId ? 0 : -1}
                    type="button"
                  >
                    <span>{category.title}</span>
                    <span
                      aria-hidden="true"
                      className="checklist-category-editor__check"
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
              className="checklist-category-editor__error"
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
