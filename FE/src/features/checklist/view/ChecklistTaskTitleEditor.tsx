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

function PencilIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m4 20 4.2-1 9.9-9.9a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
      <path d="m13.8 7.4 2.8 2.8" />
    </svg>
  );
}

export function ChecklistTaskTitleEditor({
  editing,
  task,
  titleId,
}: ChecklistTaskTitleEditorProps) {
  const [validationMessage, setValidationMessage] = useState<string>();
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const shouldRestoreFocusRef = useRef(false);
  const itemId = task.checklistItemId;
  const titleEditSession = editing?.titleEditSession;
  const isEditing = itemId !== null && titleEditSession?.itemId === itemId;
  const draft = isEditing ? titleEditSession.draft : task.title;
  const feedback = editing?.titleFeedback;
  const isCurrentFeedback =
    itemId !== null &&
    feedback?.status !== "idle" &&
    feedback?.itemId === itemId;
  const isSaving = isCurrentFeedback && feedback.status === "pending";
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
    editing.startTitleEditing(itemId, task.title);
    clearErrors();
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
      <h2 id={titleId}>{task.title}</h2>
      <button
        aria-label="할 일 제목 수정"
        className="checklist-title-editor__edit"
        onClick={startEditing}
        ref={editButtonRef}
        type="button"
      >
        <PencilIcon />
      </button>
    </div>
  );
}
