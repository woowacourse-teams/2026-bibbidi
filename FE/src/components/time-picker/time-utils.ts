export type TimePickerMinuteStep = 1 | 5 | 10 | 15 | 30;

/** Round a wall-clock time to the closest step; midnight wraps to the next day. */
export function roundTimeToStep(
  value: string,
  step: TimePickerMinuteStep = 5,
): string {
  if (![1, 5, 10, 15, 30].includes(step))
    throw new Error("TimePicker: unsupported minuteStep.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error("TimePicker: expected HH:mm (00:00–23:59).");
  const [hour, minute] = value.split(":").map(Number);
  const total = (Math.round((hour * 60 + minute) / step) * step) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
