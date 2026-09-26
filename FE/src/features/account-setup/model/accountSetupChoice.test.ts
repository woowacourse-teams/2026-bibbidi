import { afterEach, describe, expect, it } from "vitest";

import {
  clearAccountSetupChoice,
  readAccountSetupChoice,
  saveAccountSetupChoice,
} from "./accountSetupChoice";

afterEach(() => {
  clearAccountSetupChoice();
});

describe("accountSetupChoice", () => {
  it("선택한 계정 설정 폼을 저장하고 복원한다", () => {
    saveAccountSetupChoice("legacy");

    expect(readAccountSetupChoice()).toBe("legacy");
    expect(sessionStorage.getItem("bibbidi.account-setup.choice")).toBe(
      "legacy",
    );

    clearAccountSetupChoice();

    expect(readAccountSetupChoice()).toBeUndefined();
  });

  it("알 수 없는 선택값은 복원하지 않는다", () => {
    sessionStorage.setItem("bibbidi.account-setup.choice", "unknown");

    expect(readAccountSetupChoice()).toBeUndefined();
  });
});
