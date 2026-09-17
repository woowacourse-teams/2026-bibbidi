export type AppointmentManagementFailureReason =
  "forbidden" | "invalid-request" | "not-found" | "unknown";

export class AppointmentManagementError extends Error {
  constructor(
    readonly reason: AppointmentManagementFailureReason,
    message = "일정을 변경하지 못했어요. 다시 시도해 주세요.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppointmentManagementError";
  }
}
