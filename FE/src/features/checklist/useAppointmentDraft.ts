import { useState } from "react";
import {
  emptyAppointmentDraft,
  validateAppointmentDraft,
  validateAppointmentEndTime,
  type ChecklistAppointmentFormController,
  type ChecklistAppointmentFormErrors,
  type ChecklistAppointmentFormField,
} from "./model/appointmentForm";

type AppointmentDraftController = Pick<
  ChecklistAppointmentFormController,
  | "draft"
  | "errors"
  | "changeDate"
  | "changeEndTime"
  | "changeMemo"
  | "changePlace"
  | "changeStartTime"
  | "changeTitle"
  | "touchDate"
  | "touchEndTime"
  | "touchPlace"
  | "touchStartTime"
  | "touchTitle"
>;

/** Shared field state and validation; callers own submission and discard policy. */
export function useAppointmentDraft() {
  const [draft, setDraft] = useState(emptyAppointmentDraft);
  const [errors, setErrors] = useState<ChecklistAppointmentFormErrors>({});
  const replaceError = (
    field: ChecklistAppointmentFormField,
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

  const form: AppointmentDraftController = {
    changeDate: (date) => {
      setDraft((current) => ({ ...current, date }));
      if (errors.date) {
        replaceError("date", validateAppointmentDraft({ ...draft, date }).date);
      }
    },
    changeEndTime: (endTime) => {
      setDraft((current) => ({ ...current, endTime }));
      if (errors.endTime) {
        replaceError(
          "endTime",
          validateAppointmentEndTime(draft.startTime, endTime),
        );
      }
    },
    changeMemo: (memo) => setDraft((current) => ({ ...current, memo })),
    changePlace: (place) => {
      setDraft((current) => ({ ...current, place }));
      if (errors.place) {
        replaceError(
          "place",
          validateAppointmentDraft({ ...draft, place }).place,
        );
      }
    },
    changeStartTime: (startTime) => {
      setDraft((current) => ({ ...current, startTime }));
      if (errors.startTime) {
        replaceError(
          "startTime",
          validateAppointmentDraft({ ...draft, startTime }).startTime,
        );
      }
      if (errors.endTime) {
        replaceError(
          "endTime",
          validateAppointmentEndTime(startTime, draft.endTime),
        );
      }
    },
    changeTitle: (title) => {
      setDraft((current) => ({ ...current, title }));
      if (errors.title) {
        replaceError(
          "title",
          validateAppointmentDraft({ ...draft, title }).title,
        );
      }
    },
    draft,
    errors,
    touchDate: () => replaceError("date", validateAppointmentDraft(draft).date),
    touchEndTime: () =>
      replaceError(
        "endTime",
        validateAppointmentEndTime(draft.startTime, draft.endTime),
      ),
    touchPlace: () =>
      replaceError("place", validateAppointmentDraft(draft).place),
    touchStartTime: () => {
      const nextErrors = validateAppointmentDraft(draft);
      replaceError("startTime", nextErrors.startTime);
      replaceError("endTime", nextErrors.endTime);
    },
    touchTitle: () =>
      replaceError("title", validateAppointmentDraft(draft).title),
  };
  return { form, setDraft, setErrors };
}
