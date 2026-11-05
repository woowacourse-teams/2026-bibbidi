import { afterEach, describe, expect, it, vi } from "vitest";

import {
  beginAccountSetupProgress,
  clearAccountSetupProgress,
  hasAccountSetupProgress,
} from "./accountSetupProgress";
import {
  readAccountSetupChoice,
  saveAccountSetupChoice,
} from "./accountSetupChoice";

afterEach(() => {
  clearAccountSetupProgress();
  vi.unstubAllGlobals();
});

describe("accountSetupProgress", () => {
  it("비민감 진행 표시만 sessionStorage에 저장하고 완료하면 제거한다", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      removeItem: vi.fn((key: string) => values.delete(key)),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    });

    beginAccountSetupProgress();

    expect(hasAccountSetupProgress()).toBe(true);
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      "bibbidi.account-setup.pending",
      "true",
    );

    clearAccountSetupProgress();

    expect(hasAccountSetupProgress()).toBe(false);
    expect(sessionStorage.removeItem).toHaveBeenCalledWith(
      "bibbidi.account-setup.pending",
    );
  });

  it("새 가입 흐름을 시작하거나 완료하면 이전 선택을 제거한다", () => {
    saveAccountSetupChoice("legacy");

    beginAccountSetupProgress();
    expect(readAccountSetupChoice()).toBeUndefined();

    saveAccountSetupChoice("legacy");
    clearAccountSetupProgress();
    expect(readAccountSetupChoice()).toBeUndefined();
  });
});
