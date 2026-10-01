import { describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  setTag: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn(),
}));

vi.mock("@sentry/react", () => sentry);

describe("FE 오류 추적", () => {
  it("정제된 사용자·화면 문맥과 심각도를 전송하고 로그아웃 시 사용자를 지운다", async () => {
    vi.stubGlobal("__BIBBIDI_SENTRY_ENABLED__", true);
    vi.stubGlobal(
      "__BIBBIDI_SENTRY_DSN__",
      "https://public@example.ingest.sentry.io/1",
    );
    vi.stubGlobal("__BIBBIDI_APP_ENV__", "development");
    vi.stubGlobal("__BIBBIDI_APP_VERSION__", "test-commit");
    const mockScope = { setLevel: vi.fn(), setTag: vi.fn() };
    sentry.withScope.mockImplementation(
      (callback: (scope: typeof mockScope) => void) => callback(mockScope),
    );

    const tracking = await import("./index");
    tracking.initializeErrorTracking();
    tracking.setErrorContext({
      authState: "authenticated",
      pathname: "/calendar",
      userId: 42,
    });
    tracking.addErrorAction("appointment.create");
    const failure = new Error("private input");
    tracking.reportHandledError(failure, {
      feature: "calendar",
      operation: "appointment_create",
      failureKind: "network",
      level: "error",
    });
    tracking.clearErrorUser();

    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: "development",
        release: "test-commit",
        beforeSend: expect.any(Function),
        beforeBreadcrumb: expect.any(Function),
      }),
    );
    expect(sentry.setUser).toHaveBeenNthCalledWith(1, { id: "42" });
    expect(sentry.setUser).toHaveBeenLastCalledWith(null);
    expect(sentry.setTag).toHaveBeenCalledWith("page_path", "/calendar");
    expect(sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: "bibbidi.action",
      message: "appointment.create",
    });
    expect(mockScope.setLevel).toHaveBeenCalledWith("error");
    expect(mockScope.setTag).toHaveBeenCalledWith("failure_kind", "network");
    expect(sentry.captureException).toHaveBeenCalledWith(failure);
    vi.unstubAllGlobals();
  });
});
