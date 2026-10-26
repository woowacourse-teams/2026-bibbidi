import { useEffect, useRef } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import type { ChecklistAppointmentFormController } from "./model/appointmentForm";

export function useAppointmentFormView<
  PickerElement extends HTMLElement = HTMLInputElement,
>(controller: ChecklistAppointmentFormController) {
  const formRef = useRef<HTMLFormElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<PickerElement>(null);
  const startTimeRef = useRef<PickerElement>(null);
  const endTimeRef = useRef<PickerElement>(null);
  const placeRef = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  useEffect(() => {
    const title = titleRef.current;
    if (title && !title.closest("[inert]")) title.focus();
  }, []);
  useEffect(() => {
    if (controller.submissionState.status === "error")
      errorSummaryRef.current?.focus();
  }, [controller.submissionState.status]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing.current) return;
    const firstError = await controller.submit();
    if (firstError)
      ({
        title: titleRef,
        date: dateRef,
        startTime: startTimeRef,
        endTime: endTimeRef,
        place: placeRef,
      })[firstError].current?.focus();
  }
  return {
    formRef,
    errorSummaryRef,
    titleRef,
    dateRef,
    startTimeRef,
    endTimeRef,
    placeRef,
    pending: controller.submissionState.status === "submitting",
    submit,
    titleComposition: {
      onCompositionStart: () => {
        composing.current = true;
      },
      onCompositionEnd: () => {
        composing.current = false;
      },
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter" && event.nativeEvent.isComposing)
          event.preventDefault();
      },
    },
  };
}
