import { useEffect, useRef, useState } from "react";

export const CHECKLIST_TASK_TITLE_MAX_LENGTH = 50;

export interface ChecklistTaskCreationInput {
  categoryId: string;
  title: string;
}

export type ChecklistTaskCreationSubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { message?: string; status: "success" | "error" };

interface ChecklistTaskCreationDraft {
  categoryId: string | null;
  title: string;
}

interface ChecklistTaskCreationErrors {
  categoryId?: string;
  title?: string;
}

const emptyDraft: ChecklistTaskCreationDraft = {
  categoryId: null,
  title: "",
};

function validateTitle(title: string) {
  const trimmedTitle = title.trim();

  if (trimmedTitle.length === 0) {
    return "할 일 제목을 입력해 주세요.";
  }

  return trimmedTitle.length > CHECKLIST_TASK_TITLE_MAX_LENGTH
    ? "할 일 제목은 50자 이하로 입력해 주세요."
    : undefined;
}

function validateCategory(categoryId: string | null) {
  return categoryId === null ? "카테고리를 선택해 주세요." : undefined;
}

interface UseChecklistTaskCreationOptions {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onSubmit?: (
    input: ChecklistTaskCreationInput,
  ) => Promise<boolean | void> | boolean | void;
  sessionIdentity?: string;
  submissionState?: ChecklistTaskCreationSubmissionState;
}

export interface ChecklistTaskCreationController {
  canSubmit: boolean;
  cancelDiscard: () => void;
  changeCategory: (categoryId: string) => void;
  changeTitle: (title: string) => void;
  confirmDiscard: () => void;
  draft: ChecklistTaskCreationDraft;
  errors: ChecklistTaskCreationErrors;
  isDiscardDialogOpen: boolean;
  isOpen: boolean;
  open: () => void;
  requestClose: () => void;
  submit: () => Promise<"categoryId" | "title" | null>;
  submissionState: ChecklistTaskCreationSubmissionState;
  touchCategory: () => void;
  touchTitle: () => void;
}

export function useChecklistTaskCreation({
  isOpen: controlledIsOpen,
  onOpenChange,
  onSubmit,
  sessionIdentity,
  submissionState = { status: "idle" },
}: UseChecklistTaskCreationOptions): ChecklistTaskCreationController {
  const [draft, setDraft] = useState<ChecklistTaskCreationDraft>(emptyDraft);
  const [errors, setErrors] = useState<ChecklistTaskCreationErrors>({});
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const previousSessionIdentityRef = useRef(sessionIdentity);
  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;
  const wasOpenRef = useRef(isOpen);
  const isSubmitting = submissionState.status === "submitting";
  const isDirty = draft.title.length > 0 || draft.categoryId !== null;

  useEffect(() => {
    if (
      sessionIdentity === undefined ||
      previousSessionIdentityRef.current === sessionIdentity
    ) {
      return;
    }

    previousSessionIdentityRef.current = sessionIdentity;
    const shouldClose = isOpen || wasOpenRef.current;
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) {
        return;
      }

      setDraft(emptyDraft);
      setErrors({});
      setIsDiscardDialogOpen(false);

      if (controlledIsOpen === undefined) {
        setUncontrolledIsOpen(false);
      }

      if (shouldClose) {
        onOpenChange?.(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, [controlledIsOpen, isOpen, onOpenChange, sessionIdentity]);

  useEffect(() => {
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const setIsOpen = (nextIsOpen: boolean) => {
    if (controlledIsOpen === undefined) {
      setUncontrolledIsOpen(nextIsOpen);
    }

    onOpenChange?.(nextIsOpen);
  };

  const reset = () => {
    setDraft(emptyDraft);
    setErrors({});
  };

  const replaceError = (
    field: keyof ChecklistTaskCreationErrors,
    message?: string,
  ) => {
    setErrors((current) => {
      const next = { ...current };

      if (message) {
        next[field] = message;
      } else {
        delete next[field];
      }

      return next;
    });
  };

  return {
    canSubmit: onSubmit !== undefined,
    cancelDiscard: () => setIsDiscardDialogOpen(false),
    changeCategory: (categoryId) => {
      setDraft((current) => ({ ...current, categoryId }));

      if (errors.categoryId) {
        replaceError("categoryId", validateCategory(categoryId));
      }
    },
    changeTitle: (title) => {
      setDraft((current) => ({ ...current, title }));

      if (errors.title) {
        replaceError("title", validateTitle(title));
      }
    },
    confirmDiscard: () => {
      setIsDiscardDialogOpen(false);
      setIsOpen(false);
      reset();
    },
    draft,
    errors,
    isDiscardDialogOpen,
    isOpen,
    open: () => setIsOpen(true),
    requestClose: () => {
      if (isSubmitting) {
        return;
      }

      if (isDirty) {
        setIsDiscardDialogOpen(true);
      } else {
        setIsOpen(false);
        reset();
      }
    },
    submissionState,
    submit: async () => {
      if (isSubmitting) {
        return null;
      }

      const nextErrors = {
        categoryId: validateCategory(draft.categoryId),
        title: validateTitle(draft.title),
      };
      setErrors(nextErrors);

      if (nextErrors.title) {
        return "title";
      }

      if (nextErrors.categoryId) {
        return "categoryId";
      }

      if (draft.categoryId !== null && onSubmit) {
        const didSucceed = await onSubmit({
          categoryId: draft.categoryId,
          title: draft.title.trim(),
        });

        if (didSucceed === true) {
          setIsDiscardDialogOpen(false);
          setIsOpen(false);
          reset();
        }
      }

      return null;
    },
    touchCategory: () =>
      replaceError("categoryId", validateCategory(draft.categoryId)),
    touchTitle: () => replaceError("title", validateTitle(draft.title)),
  };
}
