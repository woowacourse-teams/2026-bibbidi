import { SubmitEvent, useEffect, useRef } from "react";

import { useIsMobileLayout } from "../../../shared/responsive";
import {
  CHECKLIST_TASK_TITLE_MAX_LENGTH,
  ChecklistTaskCreationController,
} from "../useChecklistTaskCreation";
import { ChecklistCategoryViewModel } from "../view-model/createChecklistViewModel";
import { ChecklistModalDialog } from "./ChecklistModalDialog";
import { containTabFocus } from "./containTabFocus";
import "./ChecklistTaskCreation.css";

interface ChecklistTaskCreationProps {
  categories: ChecklistCategoryViewModel[];
  controller: ChecklistTaskCreationController;
}

function BackIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ChecklistTaskCreation({
  categories,
  controller,
}: ChecklistTaskCreationProps) {
  const isMobileLayout = useIsMobileLayout();
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const isComposingRef = useRef(false);
  const isSubmitting = controller.submissionState.status === "submitting";
  const titleErrorId = "checklist-task-creation-title-error";
  const categoryErrorId = "checklist-task-creation-category-error";

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isMobileLayout) {
        containTabFocus(event, form);
      }

      if (
        event.key === "Escape" &&
        !(event.target instanceof HTMLSelectElement) &&
        !controller.isDiscardDialogOpen
      ) {
        event.preventDefault();
        controller.requestClose();
      }
    };

    form.addEventListener("keydown", handleKeyDown);
    return () => form.removeEventListener("keydown", handleKeyDown);
  }, [controller, isMobileLayout]);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isComposingRef.current) {
      return;
    }

    const firstError = await controller.submit();

    if (firstError === "title") {
      titleRef.current?.focus();
    } else if (firstError === "categoryId") {
      categoryRef.current?.focus();
    }
  };

  const feedback =
    controller.submissionState.status === "success"
      ? (controller.submissionState.message ?? "할 일을 추가했어요.")
      : controller.submissionState.status === "error"
        ? (controller.submissionState.message ??
          "할 일을 추가하지 못했어요. 다시 시도해 주세요.")
        : controller.submissionState.status === "submitting"
          ? "할 일을 추가하고 있어요."
          : null;

  return (
    <>
      <aside
        aria-hidden={controller.isDiscardDialogOpen ? true : undefined}
        aria-labelledby="checklist-task-creation-title"
        aria-modal={isMobileLayout ? "true" : undefined}
        className={`checklist-task-creation checklist-task-creation--${
          isMobileLayout ? "mobile" : "desktop"
        }`}
        inert={controller.isDiscardDialogOpen ? true : undefined}
        role={isMobileLayout ? "dialog" : "complementary"}
      >
        <form
          className="checklist-task-creation__form"
          noValidate
          onSubmit={(event) => void submit(event)}
          ref={formRef}
        >
          <header className="checklist-task-creation__header">
            {isMobileLayout ? (
              <button
                aria-label="체크리스트로 돌아가기"
                disabled={isSubmitting}
                onClick={controller.requestClose}
                type="button"
              >
                <BackIcon />
              </button>
            ) : null}
            <h2 id="checklist-task-creation-title">할 일 추가</h2>
            {!isMobileLayout ? (
              <button
                aria-label="할 일 추가 닫기"
                disabled={isSubmitting}
                onClick={controller.requestClose}
                type="button"
              >
                <span aria-hidden="true">×</span>
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
          </header>

          <div className="checklist-task-creation__body">
            <div className="checklist-task-creation__field">
              <div className="checklist-task-creation__field-header">
                <label htmlFor="checklist-task-creation-title-input">
                  할 일 제목 <em aria-hidden="true">*</em>
                </label>
                <span aria-live="polite">
                  {controller.draft.title.length} /{" "}
                  {CHECKLIST_TASK_TITLE_MAX_LENGTH}
                </span>
              </div>
              <input
                aria-describedby={
                  controller.errors.title ? titleErrorId : undefined
                }
                aria-invalid={controller.errors.title ? true : undefined}
                autoComplete="off"
                disabled={isSubmitting}
                id="checklist-task-creation-title-input"
                onBlur={controller.touchTitle}
                onChange={(event) => controller.changeTitle(event.target.value)}
                onCompositionEnd={() => {
                  isComposingRef.current = false;
                }}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && event.nativeEvent.isComposing) {
                    event.preventDefault();
                  }
                }}
                placeholder="할 일을 입력하세요"
                ref={titleRef}
                value={controller.draft.title}
              />
              {controller.errors.title ? (
                <p id={titleErrorId} role="alert">
                  {controller.errors.title}
                </p>
              ) : null}
            </div>

            <div className="checklist-task-creation__field">
              <label htmlFor="checklist-task-creation-category">
                카테고리 <em aria-hidden="true">*</em>
              </label>
              <select
                aria-describedby={
                  controller.errors.categoryId ? categoryErrorId : undefined
                }
                aria-invalid={controller.errors.categoryId ? true : undefined}
                disabled={isSubmitting}
                id="checklist-task-creation-category"
                onBlur={controller.touchCategory}
                onChange={(event) =>
                  controller.changeCategory(event.target.value)
                }
                ref={categoryRef}
                value={controller.draft.categoryId ?? ""}
              >
                <option disabled value="">
                  카테고리를 선택해 주세요
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.title}
                  </option>
                ))}
              </select>
              {controller.errors.categoryId ? (
                <p id={categoryErrorId} role="alert">
                  {controller.errors.categoryId}
                </p>
              ) : null}
            </div>

            {feedback ? (
              <p
                className={`checklist-task-creation__feedback checklist-task-creation__feedback--${controller.submissionState.status}`}
                role={
                  controller.submissionState.status === "error"
                    ? "alert"
                    : "status"
                }
              >
                {feedback}
              </p>
            ) : null}
          </div>

          <footer className="checklist-task-creation__footer">
            {!isMobileLayout ? (
              <button
                disabled={isSubmitting}
                onClick={controller.requestClose}
                type="button"
              >
                취소
              </button>
            ) : null}
            <button
              aria-busy={isSubmitting}
              disabled={!controller.canSubmit || isSubmitting}
              type="submit"
            >
              {isSubmitting ? "추가 중" : "추가"}
            </button>
          </footer>
        </form>
      </aside>

      {controller.isDiscardDialogOpen ? (
        <ChecklistModalDialog
          actions={
            <>
              <button onClick={controller.cancelDiscard} type="button">
                계속 작성
              </button>
              <button onClick={controller.confirmDiscard} type="button">
                나가기
              </button>
            </>
          }
          description={
            "입력한 할 일 제목과 카테고리가 저장되지 않아요.\n닫은 뒤에는 작성 내용을 복구할 수 없어요."
          }
          onEscape={controller.cancelDiscard}
          title="작성 중인 내용을 닫을까요?"
          variant="critical"
        />
      ) : null}
    </>
  );
}
