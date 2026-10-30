import { SCHEDULE_YEAR_RANGE } from "../../../shared/date/scheduleDate";
import { useAppointmentFormView } from "../useAppointmentFormView";
import { Button } from "../../../components/button";
import { TextField } from "../../../components/text-field";
import { TextArea } from "../../../components/text-area";
import { PickerField } from "../../../components/picker-field";
import { CHECKLIST_APPOINTMENT_TEXT_MAX_LENGTH } from "../model/appointmentForm";
import type { ChecklistAppointmentFormController } from "../model/appointmentForm";
import { ChecklistFormPanel } from "./ChecklistFormPanel";
import "./AppointmentForm.css";

export function AppointmentForm({
  modal = false,
  blocked = false,
  controller,
  heading = "일정 추가",
  taskTitle,
  backLabel,
  idPrefix,
}: {
  modal?: boolean;
  blocked?: boolean;
  controller: ChecklistAppointmentFormController;
  heading?: "일정 수정" | "일정 추가";
  taskTitle: string;
  backLabel: string;
  idPrefix: string;
}) {
  const {
    formRef,
    errorSummaryRef,
    titleRef,
    dateRef,
    startTimeRef,
    endTimeRef,
    placeRef,
    pending,
    submit,
    titleComposition,
  } = useAppointmentFormView<HTMLButtonElement>(controller);
  const field = (key: "title" | "place") => ({
    id: `${idPrefix}-${key === "title" ? "title-input" : key}`,
    disabled: pending,
    value: controller.draft[key],
    hasError: !!controller.errors[key],
    help: controller.errors[key] && (
      <span role="alert">{controller.errors[key]}</span>
    ),
  });
  const counter = (text: string) => (
    <span aria-live="polite">
      {text.length} / {CHECKLIST_APPOINTMENT_TEXT_MAX_LENGTH}
    </span>
  );
  return (
    <ChecklistFormPanel
      title={heading}
      titleId={`${idPrefix}-title`}
      subtitle={taskTitle}
      backLabel={backLabel}
      closeLabel={`${heading} 닫기`}
      modal={modal}
      blocked={blocked}
      isSubmitting={pending}
      onClose={controller.cancel}
      onSubmit={(event) => void submit(event)}
      formRef={formRef}
      actions={
        <>
          <Button
            size="large"
            color="dark"
            variant="weak"
            disabled={pending}
            onClick={controller.cancel}
          >
            취소
          </Button>
          <Button
            size="large"
            type="submit"
            loading={pending}
            disabled={!controller.canSubmit || pending}
          >
            {pending
              ? "저장 중"
              : controller.submissionState.status === "error"
                ? controller.submissionState.retryLabel
                : "저장"}
          </Button>
        </>
      }
    >
      <TextField
        {...field("title")}
        label="제목"
        required
        ref={titleRef}
        autoComplete="off"
        onBlur={controller.touchTitle}
        onChange={(event) => controller.changeTitle(event.target.value)}
        {...titleComposition}
        placeholder="일정 제목을 입력하세요"
        right={counter(controller.draft.title)}
      />
      <PickerField
        id={`${idPrefix}-date`}
        label="날짜"
        kind="date"
        yearRange={SCHEDULE_YEAR_RANGE}
        required
        value={controller.draft.date}
        disabled={pending}
        error={controller.errors.date}
        ref={dateRef}
        onBlur={controller.touchDate}
        onChange={controller.changeDate}
      />
      <div className="appointment-form__times">
        <PickerField
          id={`${idPrefix}-startTime`}
          label="시작 시간"
          kind="time"
          minuteStep={1}
          value={controller.draft.startTime}
          disabled={pending}
          error={controller.errors.startTime}
          ref={startTimeRef}
          onBlur={controller.touchStartTime}
          onChange={controller.changeStartTime}
        />
        <PickerField
          id={`${idPrefix}-endTime`}
          label="종료 시간"
          kind="time"
          minuteStep={1}
          value={controller.draft.endTime}
          disabled={pending}
          error={controller.errors.endTime}
          ref={endTimeRef}
          onBlur={controller.touchEndTime}
          onChange={controller.changeEndTime}
        />
      </div>
      <TextField
        {...field("place")}
        label="장소"
        ref={placeRef}
        autoComplete="off"
        onBlur={controller.touchPlace}
        onChange={(event) => controller.changePlace(event.target.value)}
        placeholder="장소를 입력하세요"
        right={counter(controller.draft.place)}
      />
      <TextArea
        label="메모"
        disabled={pending}
        value={controller.draft.memo}
        onChange={(event) => controller.changeMemo(event.target.value)}
        placeholder="메모를 입력하세요"
      />
      {controller.submissionState.status === "error" && (
        <div
          className="checklist-form-panel__feedback"
          data-error=""
          ref={errorSummaryRef}
          tabIndex={-1}
        >
          <p role="alert">{controller.submissionState.message}</p>
        </div>
      )}
    </ChecklistFormPanel>
  );
}
