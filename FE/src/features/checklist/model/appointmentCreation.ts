export type AppointmentCreationFailureReason =
  | "invalid-request"
  | "item-not-found"
  | "forbidden"
  | "api"
  | "network"
  | "timeout"
  | "contract"
  | "refresh-failed";

export class AppointmentCreationError extends Error {
  constructor(
    readonly reason: AppointmentCreationFailureReason,
    options?: ErrorOptions,
  ) {
    super(
      reason === "refresh-failed"
        ? "일정은 저장됐어요. 목록을 다시 불러와 주세요."
        : reason === "invalid-request"
          ? "입력값을 확인하고 다시 시도해 주세요."
          : "일정을 저장하지 못했어요. 다시 시도해 주세요.",
      options,
    );
    this.name = "AppointmentCreationError";
  }
}
