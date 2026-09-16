import { SubmitEvent, useEffect, useRef } from "react";

import { useIsMobileLayout } from "../../../shared/responsive";
import {
  CHECKLIST_APPOINTMENT_TEXT_MAX_LENGTH,
  ChecklistAppointmentCreationController,
} from "../useChecklistAppointmentCreation";
import { containTabFocus } from "./containTabFocus";
import "./ChecklistAppointmentCreation.css";

interface ChecklistAppointmentCreationProps {
  controller: ChecklistAppointmentCreationController;
  taskTitle: string;
}

function BackIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ChecklistAppointmentCreation({
  controller,
  taskTitle,
}: ChecklistAppointmentCreationProps) {
  const isMobileLayout = useIsMobileLayout();
  const formRef = useRef<HTMLFormElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);
  const placeRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const isSubmitting = controller.submissionState.status === "submitting";

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (controller.submissionState.status === "error") {
      errorSummaryRef.current?.focus();
    }
  }, [controller.submissionState.status]);

  useEffect(() => {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isMobileLayout) {
        containTabFocus(event, form);
      }

      if (event.key === "Escape" && !isSubmitting) {
        event.preventDefault();
        event.stopPropagation();
        controller.cancel();
      }
    };

    form.addEventListener("keydown", handleKeyDown);
    return () => form.removeEventListener("keydown", handleKeyDown);
  }, [controller, isMobileLayout, isSubmitting]);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isComposingRef.current) {
      return;
    }

    const firstError = await controller.submit();
    switch (firstError) {
      case "title":
        titleRef.current?.focus();
        break;
      case "date":
        dateRef.current?.focus();
        break;
      case "startTime":
        startTimeRef.current?.focus();
        break;
      case "endTime":
        endTimeRef.current?.focus();
        break;
      case "place":
        placeRef.current?.focus();
        break;
    }
  };

  const errorId = (field: string) =>
    `checklist-appointment-creation-${field}-error`;

  return (
    <aside
      aria-labelledby="checklist-appointment-creation-title"
      aria-modal={isMobileLayout ? "true" : undefined}
      className={`checklist-appointment-creation checklist-appointment-creation--${
        isMobileLayout ? "mobile" : "desktop"
      }`}
      role={isMobileLayout ? "dialog" : "complementary"}
    >
      <form
        className="checklist-appointment-creation__form"
        noValidate
        onSubmit={(event) => void submit(event)}
        ref={formRef}
      >
        <header className="checklist-appointment-creation__header">
          {isMobileLayout ? (
            <button
              aria-label="할 일 상세로 돌아가기"
              disabled={isSubmitting}
              onClick={controller.cancel}
              type="button"
            >
              <BackIcon />
            </button>
          ) : null}
          <span>
            <h2 id="checklist-appointment-creation-title">일정 추가</h2>
            <small>{taskTitle}</small>
          </span>
          {!isMobileLayout ? (
            <button
              aria-label="일정 추가 닫기"
              disabled={isSubmitting}
              onClick={controller.cancel}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
        </header>

        <div className="checklist-appointment-creation__body">
          <div className="checklist-appointment-creation__field">
            <div className="checklist-appointment-creation__field-header">
              <label htmlFor="checklist-appointment-creation-title-input">
                제목 <em aria-hidden="true">*</em>
              </label>
              <span aria-live="polite">
                {controller.draft.title.length} /{" "}
                {CHECKLIST_APPOINTMENT_TEXT_MAX_LENGTH}
              </span>
            </div>
            <input
              aria-describedby={
                controller.errors.title ? errorId("title") : undefined
              }
              aria-invalid={controller.errors.title ? true : undefined}
              autoComplete="off"
              disabled={isSubmitting}
              id="checklist-appointment-creation-title-input"
              onBlur={controller.touchTitle}
              onChange={(event) => controller.changeTitle(event.target.value)}
              onCompositionEnd={() => {
                isComposingRef.current = false;
              }}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              placeholder="일정 제목을 입력하세요"
              ref={titleRef}
              value={controller.draft.title}
            />
            {controller.errors.title ? (
              <p id={errorId("title")} role="alert">
                {controller.errors.title}
              </p>
            ) : null}
          </div>

          <div className="checklist-appointment-creation__field">
            <label htmlFor="checklist-appointment-creation-date">
              날짜 <em aria-hidden="true">*</em>
            </label>
            <input
              aria-describedby={
                controller.errors.date ? errorId("date") : undefined
              }
              aria-invalid={controller.errors.date ? true : undefined}
              disabled={isSubmitting}
              id="checklist-appointment-creation-date"
              onBlur={controller.touchDate}
              onChange={(event) => controller.changeDate(event.target.value)}
              ref={dateRef}
              type="date"
              value={controller.draft.date}
            />
            {controller.errors.date ? (
              <p id={errorId("date")} role="alert">
                {controller.errors.date}
              </p>
            ) : null}
          </div>

          <div className="checklist-appointment-creation__time-fields">
            <div className="checklist-appointment-creation__field">
              <label htmlFor="checklist-appointment-creation-start-time">
                시작 시간
              </label>
              <input
                aria-describedby={
                  controller.errors.startTime ? errorId("startTime") : undefined
                }
                aria-invalid={controller.errors.startTime ? true : undefined}
                disabled={isSubmitting}
                id="checklist-appointment-creation-start-time"
                onBlur={controller.touchStartTime}
                onChange={(event) =>
                  controller.changeStartTime(event.target.value)
                }
                ref={startTimeRef}
                type="time"
                value={controller.draft.startTime}
              />
              {controller.errors.startTime ? (
                <p id={errorId("startTime")} role="alert">
                  {controller.errors.startTime}
                </p>
              ) : null}
            </div>

            <div className="checklist-appointment-creation__field">
              <label htmlFor="checklist-appointment-creation-end-time">
                종료 시간
              </label>
              <input
                aria-describedby={
                  controller.errors.endTime ? errorId("endTime") : undefined
                }
                aria-invalid={controller.errors.endTime ? true : undefined}
                disabled={isSubmitting}
                id="checklist-appointment-creation-end-time"
                onBlur={controller.touchEndTime}
                onChange={(event) =>
                  controller.changeEndTime(event.target.value)
                }
                ref={endTimeRef}
                type="time"
                value={controller.draft.endTime}
              />
              {controller.errors.endTime ? (
                <p id={errorId("endTime")} role="alert">
                  {controller.errors.endTime}
                </p>
              ) : null}
            </div>
          </div>

          <div className="checklist-appointment-creation__field">
            <div className="checklist-appointment-creation__field-header">
              <label htmlFor="checklist-appointment-creation-place">장소</label>
              <span aria-live="polite">
                {controller.draft.place.length} /{" "}
                {CHECKLIST_APPOINTMENT_TEXT_MAX_LENGTH}
              </span>
            </div>
            <input
              aria-describedby={
                controller.errors.place ? errorId("place") : undefined
              }
              aria-invalid={controller.errors.place ? true : undefined}
              autoComplete="off"
              disabled={isSubmitting}
              id="checklist-appointment-creation-place"
              onBlur={controller.touchPlace}
              onChange={(event) => controller.changePlace(event.target.value)}
              placeholder="장소를 입력하세요"
              ref={placeRef}
              value={controller.draft.place}
            />
            {controller.errors.place ? (
              <p id={errorId("place")} role="alert">
                {controller.errors.place}
              </p>
            ) : null}
          </div>

          <div className="checklist-appointment-creation__field">
            <label htmlFor="checklist-appointment-creation-memo">메모</label>
            <textarea
              disabled={isSubmitting}
              id="checklist-appointment-creation-memo"
              onChange={(event) => controller.changeMemo(event.target.value)}
              placeholder="메모를 입력하세요"
              rows={4}
              value={controller.draft.memo}
            />
          </div>

          {!controller.canSubmit ? (
            <p className="checklist-appointment-creation__availability">
              일정 저장 기능은 준비 중이에요.
            </p>
          ) : null}

          {controller.submissionState.status === "error" ? (
            <div
              className="checklist-appointment-creation__feedback"
              ref={errorSummaryRef}
              tabIndex={-1}
            >
              <p role="alert">{controller.submissionState.message}</p>
            </div>
          ) : null}
        </div>

        <footer className="checklist-appointment-creation__footer">
          <button
            disabled={isSubmitting}
            onClick={controller.cancel}
            type="button"
          >
            취소
          </button>
          <button
            aria-busy={isSubmitting}
            disabled={!controller.canSubmit || isSubmitting}
            type="submit"
          >
            {isSubmitting ? "저장 중" : "저장"}
          </button>
        </footer>
      </form>
    </aside>
  );
}
