import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSafeLoginReturnPath,
  rememberLoginReturnPath,
  readLoginReturnPath,
  consumeLoginReturnPath,
} from "./loginReturnPath";

afterEach(() => {
  window.sessionStorage.clear();
  vi.useRealTimers();
});
describe("loginReturnPath", () => {
  it("OAuth 왕복용 복귀 주소는 한 번만 소비하고 30분 후 만료한다", () => {
    vi.useFakeTimers();
    rememberLoginReturnPath("?returnTo=%2Fbalance-game");
    expect(readLoginReturnPath()).toBe("/balance-game");
    expect(consumeLoginReturnPath()).toBe("/balance-game");
    expect(readLoginReturnPath()).toBeNull();
    rememberLoginReturnPath("?returnTo=%2Fbalance-game");
    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    expect(readLoginReturnPath()).toBeNull();
  });
  it("일반 로그인과 외부 주소는 이전 복귀 주소를 남기지 않는다", () => {
    rememberLoginReturnPath("?returnTo=%2Fbalance-game");
    rememberLoginReturnPath("?returnTo=https%3A%2F%2Fevil.example");
    expect(readLoginReturnPath()).toBeNull();
  });

  it("밸런스게임으로 복귀하되 임의의 하위 경로는 허용하지 않는다", () => {
    expect(getSafeLoginReturnPath("?returnTo=%2Fbalance-game")).toBe(
      "/balance-game",
    );
    expect(
      getSafeLoginReturnPath("?returnTo=%2Fbalance-game%2Fevil"),
    ).toBeNull();
  });
  it("허용한 내부 캘린더 경로만 복귀 경로로 사용한다", () => {
    expect(getSafeLoginReturnPath("?returnTo=%2Fcalendar")).toBe("/calendar");
    expect(getSafeLoginReturnPath("?returnTo=%2Fplanner")).toBe(null);
    expect(getSafeLoginReturnPath("?returnTo=https%3A%2F%2Fevil.example")).toBe(
      null,
    );
    expect(getSafeLoginReturnPath("?returnTo=%2Fchecklist")).toBe(null);
    expect(getSafeLoginReturnPath("?returnTo=%2F%2Fevil.example")).toBe(null);
    expect(getSafeLoginReturnPath("")).toBe(null);
  });
  it("선택한 항목을 보존하되 임의 주소나 추가 파라미터를 허용하지 않는다", () => {
    expect(
      getSafeLoginReturnPath("?returnTo=%2Fcalendar%3FdateFor%3D101"),
    ).toBe("/calendar?dateFor=101");
    expect(
      getSafeLoginReturnPath("?returnTo=%2Fcalendar%3FdateFor%3D-1"),
    ).toBeNull();
    expect(
      getSafeLoginReturnPath(
        "?returnTo=%2Fcalendar%3FdateFor%3D101%26redirect%3Dhttps%3A%2F%2Fevil.example",
      ),
    ).toBeNull();
  });
});
