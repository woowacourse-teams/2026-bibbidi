import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistTaskViewModel } from "../view-model/createChecklistViewModel";
import "./ChecklistTaskTitleEditor.css";

interface ChecklistTaskTitleEditorProps {
  editing?: ChecklistItemEditingController;
  task: ChecklistTaskViewModel;
  titleId: string;
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

export function ChecklistTaskTitleEditor({
  editing,
  task,
  titleId,
}: ChecklistTaskTitleEditorProps) {
  const [validationMessage, setValidationMessage] = useState<string>();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const titleMenuItemRef = useRef<HTMLButtonElement>(null);
  const deleteMenuItemRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const shouldRestoreFocusRef = useRef(false);
  const itemId = task.checklistItemId;
  const titleEditSession = editing?.titleEditSession;
  const isEditing = itemId !== null && titleEditSession?.itemId === itemId;
  const draft = isEditing ? titleEditSession.draft : task.title;
  const feedback = editing?.changeFeedback;
  const isSaving = feedback?.status === "pending";
  const isCurrentFeedback =
    itemId !== null &&
    feedback?.status !== "idle" &&
    feedback?.itemId === itemId &&
    feedback.kind === "title";
  const errorMessage =
    validationMessage ??
    (isCurrentFeedback && feedback.status === "error"
      ? feedback.errorMessage
      : undefined);
  const errorId = `${task.id}-title-error`;

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }

    if (shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false;
      editButtonRef.current?.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isMenuOpen) return;

    titleMenuItemRef.current?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target) &&
        event.target !== editButtonRef.current
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isMenuOpen]);

  if (!task.isEditable || itemId === null || !editing) {
    return <h2 id={titleId}>{task.title}</h2>;
  }

  const clearErrors = () => {
    setValidationMessage(undefined);
    editing.clearError(itemId);
  };

  const finishEditing = () => {
    shouldRestoreFocusRef.current = true;
    editing.finishTitleEditing(itemId);
    setValidationMessage(undefined);
    editing.clearError(itemId);
  };

  const startEditing = () => {
    setIsMenuOpen(false);
    editing.startTitleEditing(itemId, task.title);
    clearErrors();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setIsMenuOpen(false);
      editButtonRef.current?.focus();
      return;
    }

    const items = [titleMenuItemRef.current, deleteMenuItemRef.current].filter(
      (item): item is HTMLButtonElement => item !== null,
    );
    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown")
      nextIndex = (Math.max(0, currentIndex) + 1) % items.length;
    if (event.key === "ArrowUp")
      nextIndex = (currentIndex <= 0 ? items.length : currentIndex) - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      items[nextIndex]?.focus();
    }
  };

  const submit = async () => {
    if (isSaving || isSubmittingRef.current) {
      return;
    }

    const title = draft.trim();

    if (title.length === 0) {
      setValidationMessage("할 일 제목을 입력해주세요.");
      return;
    }

    if (title.length > 50) {
      setValidationMessage("할 일 제목은 50자 이하로 입력해주세요.");
      return;
    }

    if (title === task.title.trim()) {
      finishEditing();
      return;
    }

    isSubmittingRef.current = true;
    clearErrors();

    try {
      if (await editing.changeTitle(itemId, title)) {
        shouldRestoreFocusRef.current = true;
        editing.finishTitleEditing(itemId);
      }
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void submit();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finishEditing();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    editing.updateTitleDraft(itemId, event.target.value);
    clearErrors();
  };

  if (isEditing) {
    return (
      <div className="checklist-title-editor">
        <span className="checklist-title-editor__accessible-title" id={titleId}>
          {task.title} 제목 수정
        </span>
        <form className="checklist-title-editor__form" onSubmit={handleSubmit}>
          <input
            aria-describedby={errorMessage ? errorId : undefined}
            aria-invalid={errorMessage ? true : undefined}
            aria-label="할 일 제목"
            className="checklist-title-editor__input"
            disabled={isSaving}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            ref={inputRef}
            value={draft}
          />
          <button
            aria-label="할 일 제목 저장"
            className="checklist-title-editor__action checklist-title-editor__action--save"
            disabled={isSaving}
            type="submit"
          >
            <span aria-hidden="true">✓</span>
          </button>
          <button
            aria-label="할 일 제목 수정 취소"
            className="checklist-title-editor__action"
            disabled={isSaving}
            onClick={finishEditing}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </form>
        {errorMessage ? (
          <span
            className="checklist-title-editor__error"
            id={errorId}
            role="alert"
          >
            {errorMessage}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="checklist-title-editor checklist-title-editor--read">
      <button
        aria-controls={`${task.id}-task-menu`}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        aria-label="할 일 제목 수정"
        className="checklist-title-editor__edit"
        disabled={isSaving}
        onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
        ref={editButtonRef}
        type="button"
      >
        <MoreIcon />
      </button>
      {isMenuOpen ? (
        <div
          className="checklist-title-editor__menu"
          id={`${task.id}-task-menu`}
          onKeyDown={handleMenuKeyDown}
          ref={menuRef}
          role="menu"
          tabIndex={-1}
        >
          <button
            onClick={startEditing}
            ref={titleMenuItemRef}
            role="menuitem"
            type="button"
          >
            제목 변경
          </button>
          {editing.requestDelete && task.checklistItemStatus !== "done" ? (
            <button
              className="checklist-title-editor__menu-delete"
              onClick={() => {
                setIsMenuOpen(false);
                editing.requestDelete?.(itemId);
              }}
              ref={deleteMenuItemRef}
              role="menuitem"
              type="button"
            >
              삭제
            </button>
          ) : null}
        </div>
      ) : null}
      <h2 id={titleId}>{task.title}</h2>
    </div>
  );
}
