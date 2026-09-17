export const CHECKLIST_APPOINTMENT_TEXT_MAX_LENGTH = 255;

export interface ChecklistAppointmentFormDraft {
  date: string;
  endTime: string;
  memo: string;
  place: string;
  startTime: string;
  title: string;
}

export interface ChecklistAppointmentFormErrors {
  date?: string;
  endTime?: string;
  place?: string;
  startTime?: string;
  title?: string;
}

export type ChecklistAppointmentFormField =
  keyof ChecklistAppointmentFormErrors;

export const emptyAppointmentDraft: ChecklistAppointmentFormDraft = {
  date: "",
  endTime: "",
  memo: "",
  place: "",
  startTime: "",
  title: "",
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

export function validateAppointmentEndTime(startTime: string, endTime: string) {
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

export function validateAppointmentDraft(
  draft: ChecklistAppointmentFormDraft,
): ChecklistAppointmentFormErrors {
  return {
    date: validateDate(draft.date),
    endTime: validateAppointmentEndTime(draft.startTime, draft.endTime),
    place: validatePlace(draft.place),
    startTime: validateTime(draft.startTime, "시작 시간"),
    title: validateTitle(draft.title),
  };
}

export function getFirstAppointmentErrorField(
  errors: ChecklistAppointmentFormErrors,
): ChecklistAppointmentFormField | null {
  const order: ChecklistAppointmentFormField[] = [
    "title",
    "date",
    "startTime",
    "endTime",
    "place",
  ];

  return order.find((field) => errors[field] !== undefined) ?? null;
}

export function toLocalDateTime(date: string, time: string) {
  return time.length > 0 ? `${date}T${time}:00` : undefined;
}

export function toOptionalAppointmentText(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function toTimeInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  const match = /(?:^|T)(\d{2}:\d{2})(?::\d{2})?/.exec(value);
  return match?.[1] ?? "";
}
