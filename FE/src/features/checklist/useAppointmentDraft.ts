import { useState } from "react";

import {
  ChecklistAppointmentFormDraft,
  ChecklistAppointmentFormErrors,
  ChecklistAppointmentFormField,
  emptyAppointmentDraft,
  validateAppointmentDraft,
  validateAppointmentEndTime,
} from "./model/appointmentForm";

/** Shared input state only; each flow owns commands and when to reset. */
export function useAppointmentDraft() {
  const [draft, setDraft] = useState<ChecklistAppointmentFormDraft>(
    emptyAppointmentDraft,
  );
  const [errors, setErrors] = useState<ChecklistAppointmentFormErrors>({});

  const replaceError = (
    field: ChecklistAppointmentFormField,
    message?: string,
  ) => {
    setErrors((current) => {
      const next = { ...current };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  };

  return {
    draft,
    errors,
    setDraft,
    setErrors,
    changeDate: (date: string) => {
      setDraft((current) => ({ ...current, date }));
      if (errors.date)
        replaceError("date", validateAppointmentDraft({ ...draft, date }).date);
    },
    changeEndTime: (endTime: string) => {
      setDraft((current) => ({ ...current, endTime }));
      if (errors.endTime)
        replaceError(
          "endTime",
          validateAppointmentEndTime(draft.startTime, endTime),
        );
    },
    changeMemo: (memo: string) => setDraft((current) => ({ ...current, memo })),
    changePlace: (place: string) => {
      setDraft((current) => ({ ...current, place }));
      if (errors.place)
        replaceError(
          "place",
          validateAppointmentDraft({ ...draft, place }).place,
        );
    },
    changeStartTime: (startTime: string) => {
      setDraft((current) => ({ ...current, startTime }));
      if (errors.startTime)
        replaceError(
          "startTime",
          validateAppointmentDraft({ ...draft, startTime }).startTime,
        );
      if (errors.endTime)
        replaceError(
          "endTime",
          validateAppointmentEndTime(startTime, draft.endTime),
        );
    },
    changeTitle: (title: string) => {
      setDraft((current) => ({ ...current, title }));
      if (errors.title)
        replaceError(
          "title",
          validateAppointmentDraft({ ...draft, title }).title,
        );
    },
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
}
