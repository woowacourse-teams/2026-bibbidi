import { useEffect, useRef, useState } from "react";

export const CHECKLIST_APPOINTMENT_TEXT_MAX_LENGTH = 255;

export interface ChecklistAppointmentCreationInput {
  checklistItemId: number;
  date: string;
  endTime?: string;
  memo?: string;
  place?: string;
  startTime?: string;
  title: string;
}

export type ChecklistAppointmentCreationSubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { message?: string; status: "error" };

export interface ChecklistAppointmentCreationDraft {
  date: string;
  endTime: string;
  memo: string;
  place: string;
  startTime: string;
  title: string;
}

export interface ChecklistAppointmentCreationErrors {
  date?: string;
  endTime?: string;
  place?: string;
  startTime?: string;
  title?: string;
}

export type ChecklistAppointmentCreationField =
  keyof ChecklistAppointmentCreationErrors;

interface UseChecklistAppointmentCreationOptions {
  checklistItemId: number | null;
  isAuthenticated: boolean;
  onSubmit?: (
    input: ChecklistAppointmentCreationInput,
  ) => Promise<boolean | void> | boolean | void;
  sessionIdentity?: string;
}

export interface ChecklistAppointmentCreationController {
  canSubmit: boolean;
  cancel: () => void;
  changeDate: (date: string) => void;
  changeEndTime: (endTime: string) => void;
  changeMemo: (memo: string) => void;
  changePlace: (place: string) => void;
  changeStartTime: (startTime: string) => void;
  changeTitle: (title: string) => void;
  draft: ChecklistAppointmentCreationDraft;
  errors: ChecklistAppointmentCreationErrors;
  isOpen: boolean;
  open: () => void;
  submissionState: ChecklistAppointmentCreationSubmissionState;
  submit: () => Promise<ChecklistAppointmentCreationField | null>;
  touchDate: () => void;
  touchEndTime: () => void;
  touchPlace: () => void;
  touchStartTime: () => void;
  touchTitle: () => void;
}

const emptyDraft: ChecklistAppointmentCreationDraft = {
  date: "",
  endTime: "",
  memo: "",
  place: "",
  startTime: "",
  title: "",
};

const idleSubmissionState: ChecklistAppointmentCreationSubmissionState = {
  status: "idle",
};

function validateTitle(title: string) {
  const trimmedTitle = title.trim();

  if (trimmedTitle.length === 0) {
    return "일정 제목을 입력해 주세요.";
  }

  return trimmedTitle.length > CHECKLIST_APPOINTMENT_TEXT_MAX_LENGTH
    ? "일정 제목은 255자 이하로 입력해 주세요."
    : undefined;
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isValidDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysPerMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysPerMonth[month - 1]
  );
}

function validateDate(date: string) {
  if (date.length === 0) {
    return "날짜를 선택해 주세요.";
  }

  return isValidDate(date)
    ? undefined
    : "날짜를 YYYY-MM-DD 형식의 유효한 날짜로 입력해 주세요.";
}

function isValidTime(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);

  return match !== null && Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

function validateTime(time: string, label: string) {
  return time.length === 0 || isValidTime(time)
    ? undefined
    : `${label}을 HH:mm 형식으로 입력해 주세요.`;
}

function validateEndTime(startTime: string, endTime: string) {
  const formatError = validateTime(endTime, "종료 시간");

  if (formatError) {
    return formatError;
  }

  return startTime && endTime && isValidTime(startTime) && startTime > endTime
    ? "종료 시간은 시작 시간보다 빠를 수 없어요."
    : undefined;
}

function validatePlace(place: string) {
  return place.trim().length > CHECKLIST_APPOINTMENT_TEXT_MAX_LENGTH
    ? "장소는 255자 이하로 입력해 주세요."
    : undefined;
}

function validateDraft(
  draft: ChecklistAppointmentCreationDraft,
): ChecklistAppointmentCreationErrors {
  return {
    date: validateDate(draft.date),
    endTime: validateEndTime(draft.startTime, draft.endTime),
    place: validatePlace(draft.place),
    startTime: validateTime(draft.startTime, "시작 시간"),
    title: validateTitle(draft.title),
  };
}

function firstErrorField(
  errors: ChecklistAppointmentCreationErrors,
): ChecklistAppointmentCreationField | null {
  const order: ChecklistAppointmentCreationField[] = [
    "title",
    "date",
    "startTime",
    "endTime",
    "place",
  ];

  return order.find((field) => errors[field] !== undefined) ?? null;
}

function localDateTime(date: string, time: string) {
  return time.length > 0 ? `${date}T${time}:00` : undefined;
}

function optionalText(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function useChecklistAppointmentCreation({
  checklistItemId,
  isAuthenticated,
  onSubmit,
  sessionIdentity,
}: UseChecklistAppointmentCreationOptions): ChecklistAppointmentCreationController {
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState<ChecklistAppointmentCreationErrors>({});
  const [isOpen, setIsOpen] = useState(false);
  const [submissionState, setSubmissionState] =
    useState<ChecklistAppointmentCreationSubmissionState>(idleSubmissionState);
  const contextKey = `${isAuthenticated ? "authenticated" : "unauthenticated"}:${
    sessionIdentity ?? "unknown"
  }:${checklistItemId ?? "none"}`;
  const [activeContextKey, setActiveContextKey] = useState(contextKey);
  const requestGenerationRef = useRef(0);
  const submissionInFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const isCurrentContext = activeContextKey === contextKey;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      requestGenerationRef.current += 1;
      submissionInFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (activeContextKey === contextKey) {
      return;
    }

    requestGenerationRef.current += 1;
    submissionInFlightRef.current = false;
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) {
        return;
      }

      setActiveContextKey(contextKey);
      setDraft(emptyDraft);
      setErrors({});
      setIsOpen(false);
      setSubmissionState(idleSubmissionState);
    });

    return () => {
      isActive = false;
    };
  }, [activeContextKey, contextKey]);

  const replaceError = (
    field: ChecklistAppointmentCreationField,
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

  const resetAndClose = () => {
    requestGenerationRef.current += 1;
    submissionInFlightRef.current = false;
    setDraft(emptyDraft);
    setErrors({});
    setSubmissionState(idleSubmissionState);
    setIsOpen(false);
  };

  return {
    canSubmit:
      isAuthenticated && checklistItemId !== null && onSubmit !== undefined,
    cancel: () => {
      if (!submissionInFlightRef.current) {
        resetAndClose();
      }
    },
    changeDate: (date) => {
      setDraft((current) => ({ ...current, date }));
      if (errors.date) replaceError("date", validateDate(date));
    },
    changeEndTime: (endTime) => {
      setDraft((current) => ({ ...current, endTime }));
      if (errors.endTime) {
        replaceError("endTime", validateEndTime(draft.startTime, endTime));
      }
    },
    changeMemo: (memo) => setDraft((current) => ({ ...current, memo })),
    changePlace: (place) => {
      setDraft((current) => ({ ...current, place }));
      if (errors.place) replaceError("place", validatePlace(place));
    },
    changeStartTime: (startTime) => {
      setDraft((current) => ({ ...current, startTime }));
      if (errors.startTime) {
        replaceError("startTime", validateTime(startTime, "시작 시간"));
      }
      if (errors.endTime) {
        replaceError("endTime", validateEndTime(startTime, draft.endTime));
      }
    },
    changeTitle: (title) => {
      setDraft((current) => ({ ...current, title }));
      if (errors.title) replaceError("title", validateTitle(title));
    },
    draft,
    errors,
    isOpen: isCurrentContext && isOpen,
    open: () => {
      if (isAuthenticated && checklistItemId !== null) {
        setIsOpen(true);
      }
    },
    submissionState,
    submit: async () => {
      if (
        submissionInFlightRef.current ||
        !isAuthenticated ||
        checklistItemId === null ||
        !onSubmit
      ) {
        return null;
      }

      const nextErrors = validateDraft(draft);
      setErrors(nextErrors);
      const firstError = firstErrorField(nextErrors);

      if (firstError) {
        return firstError;
      }

      const requestGeneration = requestGenerationRef.current + 1;
      requestGenerationRef.current = requestGeneration;
      submissionInFlightRef.current = true;
      setSubmissionState({ status: "submitting" });

      try {
        const didSucceed = await onSubmit({
          checklistItemId,
          date: draft.date,
          endTime: localDateTime(draft.date, draft.endTime),
          memo: optionalText(draft.memo),
          place: optionalText(draft.place),
          startTime: localDateTime(draft.date, draft.startTime),
          title: draft.title.trim(),
        });

        if (
          !isMountedRef.current ||
          requestGenerationRef.current !== requestGeneration
        ) {
          return null;
        }

        if (didSucceed !== false) {
          resetAndClose();
        } else {
          setSubmissionState(idleSubmissionState);
        }
      } catch {
        if (
          isMountedRef.current &&
          requestGenerationRef.current === requestGeneration
        ) {
          setSubmissionState({
            message: "일정을 저장하지 못했어요. 다시 시도해 주세요.",
            status: "error",
          });
        }
      } finally {
        if (requestGenerationRef.current === requestGeneration) {
          submissionInFlightRef.current = false;
        }
      }

      return null;
    },
    touchDate: () => replaceError("date", validateDate(draft.date)),
    touchEndTime: () =>
      replaceError("endTime", validateEndTime(draft.startTime, draft.endTime)),
    touchPlace: () => replaceError("place", validatePlace(draft.place)),
    touchStartTime: () => {
      replaceError("startTime", validateTime(draft.startTime, "시작 시간"));
      replaceError("endTime", validateEndTime(draft.startTime, draft.endTime));
    },
    touchTitle: () => replaceError("title", validateTitle(draft.title)),
  };
}
