import { useEffect, useRef } from "react";
import type { FormEvent, RefObject } from "react";
import { Button } from "../../../components/button";
import { TextField } from "../../../components/text-field";
import { Select, type SelectHandle } from "../../../components/select";
import { useReturnFocus } from "../../../shared/focus/useReturnFocus";
import { useIsMobileLayout } from "../../../shared/responsive";
import {
  CHECKLIST_TASK_TITLE_MAX_LENGTH,
  ChecklistTaskCreationController,
} from "../useChecklistTaskCreation";
import { ChecklistCategoryViewModel } from "../view-model/createChecklistViewModel";
import { ChecklistFormPanel } from "./ChecklistFormPanel";
import { ChecklistDiscardDialog } from "./ChecklistDiscardDialog";

interface ChecklistTaskCreationProps {
  modal?: boolean;
  categories: ChecklistCategoryViewModel[];
  controller: ChecklistTaskCreationController;
  returnFocusRef?: RefObject<HTMLElement | null>;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}
export function ChecklistTaskCreation({
  modal = false,
  categories,
  controller,
  returnFocusRef,
  fallbackFocusRef,
}: ChecklistTaskCreationProps) {
  const mobile = useIsMobileLayout();
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<SelectHandle>(null);
  const composing = useRef(false);
  const pending = controller.submissionState.status === "submitting";
  useReturnFocus(formRef, returnFocusRef, fallbackFocusRef);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing.current) return;
    const error = await controller.submit();
    if (error === "title") titleRef.current?.focus();
    else if (error === "categoryId") categoryRef.current?.focus();
  }
  const state = controller.submissionState;
  const feedback =
    state.status === "success"
      ? (state.message ?? "할 일을 추가했어요.")
      : state.status === "error"
        ? (state.message ?? "할 일을 추가하지 못했어요. 다시 시도해 주세요.")
        : pending
          ? "할 일을 추가하고 있어요."
          : null;
  return (
    <>
      <ChecklistFormPanel
        title="할 일 추가"
        titleId="checklist-task-creation-title"
        backLabel="체크리스트로 돌아가기"
        closeLabel="할 일 추가 닫기"
        modal={modal}
        blocked={controller.isDiscardDialogOpen}
        isSubmitting={pending}
        onClose={controller.requestClose}
        onSubmit={(event) => void submit(event)}
        formRef={formRef}
        actions={
          <>
            {!mobile && (
              <Button
                size="large"
                color="dark"
                variant="weak"
                disabled={pending}
                onClick={controller.requestClose}
              >
                취소
              </Button>
            )}
            <Button
              size="large"
              type="submit"
              loading={pending}
              disabled={!controller.canSubmit || pending}
            >
              {pending ? "추가 중" : "추가"}
            </Button>
          </>
        }
      >
        <TextField
          label="할 일 제목"
          required
          id="checklist-task-creation-title-input"
          autoComplete="off"
          ref={titleRef}
          value={controller.draft.title}
          disabled={pending}
          onBlur={controller.touchTitle}
          onChange={(event) => controller.changeTitle(event.target.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.nativeEvent.isComposing)
              event.preventDefault();
          }}
          placeholder="할 일을 입력하세요"
          hasError={!!controller.errors.title}
          help={
            controller.errors.title && (
              <span role="alert">{controller.errors.title}</span>
            )
          }
          right={
            <span aria-live="polite">
              {controller.draft.title.length} /{" "}
              {CHECKLIST_TASK_TITLE_MAX_LENGTH}
            </span>
          }
        />
        <Select
          label="카테고리"
          required
          id="checklist-task-creation-category"
          ref={categoryRef}
          options={categories.map((category) => ({
            value: category.id,
            label: category.title,
          }))}
          placeholder="카테고리를 선택해 주세요"
          disabled={pending}
          value={controller.draft.categoryId ?? ""}
          onBlur={controller.touchCategory}
          onChange={controller.changeCategory}
          error={controller.errors.categoryId}
        />
        {feedback && (
          <p
            className="checklist-form-panel__feedback"
            data-error={state.status === "error" || undefined}
            data-success={state.status === "success" || undefined}
            role={state.status === "error" ? "alert" : "status"}
          >
            {feedback}
          </p>
        )}
      </ChecklistFormPanel>
      {controller.isDiscardDialogOpen && (
        <ChecklistDiscardDialog
          onContinue={controller.cancelDiscard}
          onDiscard={controller.confirmDiscard}
          description={
            "입력한 할 일 제목과 카테고리가 저장되지 않아요.\n닫은 뒤에는 작성 내용을 복구할 수 없어요."
          }
        />
      )}
    </>
  );
}
