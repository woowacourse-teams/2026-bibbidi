import { afterEach, describe, expect, it, vi } from "vitest";
import { result } from "../test/fixtures";
import {
  readBalanceGameDraft,
  writeBalanceGameDraft,
} from "./balanceGameDraft";

afterEach(() => {
  window.sessionStorage.clear();
  vi.useRealTimers();
});

describe("로그인 전 게임 선택 보관", () => {
  const draft = {
    result,
    answers: [{ questionId: "Q1", optionId: "A" }],
    selectedIds: [22],
    tracking: {
      runId: "run-1",
      answerRevision: 1,
      started: true,
      resultId: "result-1",
    },
  };
  it("선택과 결과 요청 ID를 복원하고 30분 후에는 사용하지 않는다", () => {
    vi.useFakeTimers();
    expect(writeBalanceGameDraft(draft)).toBe(true);
    expect(readBalanceGameDraft()).toEqual(draft);
    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    expect(readBalanceGameDraft()).toBeUndefined();
  });
  it("추천에 없는 선택이나 잘못된 구조를 복원하지 않는다", () => {
    writeBalanceGameDraft({ ...draft, selectedIds: [999999] });
    expect(readBalanceGameDraft()).toBeUndefined();
    window.sessionStorage.setItem("bibbidi:balance-game:login-draft:v1", "{");
    expect(readBalanceGameDraft()).toBeUndefined();
  });
});
