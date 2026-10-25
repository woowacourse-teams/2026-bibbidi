import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { IconButton } from "../../../components/icon-button";
import { TextField } from "../../../components/text-field";
import { CheckIcon, CloseIcon } from "../../../components/icons/ActionIcons";
import { validateChecklistTaskTitle } from "../model/taskTitle";
import "./ChecklistTaskTitleEditor.css";

interface ChecklistTaskTitleEditorProps {
  draft: string;
  errorMessage?: string;
  isSaving: boolean;
  onDraftChange: (draft: string) => void;
  onFinish: () => void;
  onSave: (title: string) => Promise<boolean>;
  taskId: string;
  title: string;
  titleId: string;
}

export function ChecklistTaskTitleEditor({
  draft,
  errorMessage: requestError,
  isSaving,
  onDraftChange,
  onFinish,
  onSave,
  taskId,
  title: originalTitle,
  titleId,
}: ChecklistTaskTitleEditorProps) {
  const [validationMessage, setValidationMessage] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const errorMessage = validationMessage ?? requestError;
  const errorId = `${taskId}-title-error`;
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = async () => {
    if (isSaving || isSubmittingRef.current) return;
    const title = draft.trim();
    const validationError = validateChecklistTaskTitle(title);
    if (validationError) {
      setValidationMessage(validationError);
      return;
    }
    if (title === originalTitle.trim()) {
      onFinish();
      return;
    }
    isSubmittingRef.current = true;
    setValidationMessage(undefined);
    try {
      if (await onSave(title)) onFinish();
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
      onFinish();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onDraftChange(event.target.value);
    setValidationMessage(undefined);
  };

  return (
    <div className="checklist-title-editor">
      <span className="checklist-title-editor__accessible-title" id={titleId}>
        {originalTitle} 제목 수정
      </span>
      <form className="checklist-title-editor__form" onSubmit={handleSubmit}>
        <TextField
          label="할 일 제목"
          labelHidden
          variant="line"
          hasError={!!errorMessage}
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
        <IconButton
          icon={<CheckIcon />}
          aria-label="할 일 제목 저장"
          disabled={isSaving}
          type="submit"
        />
        <IconButton
          icon={<CloseIcon />}
          aria-label="할 일 제목 수정 취소"
          disabled={isSaving}
          onClick={onFinish}
          type="button"
        />
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
