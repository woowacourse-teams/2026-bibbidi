import { afterEach, describe, expect, it, vi } from "vitest";
import { questions, result, wireQuestions } from "../test/fixtures";
import {
  BalanceGameApiError,
  getBalanceGameQuestions,
  getBalanceGameResult,
  parseQuestions,
  parseResult,
} from "./balanceGame";

afterEach(() => vi.unstubAllGlobals());
describe("PR #743 밸런스게임 공개 API", () => {
  it("로그인 정보 없이 문항을 받고 서버 순서와 문자열 ID를 유지한다", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(wireQuestions));
    vi.stubGlobal("fetch", fetch);
    const loaded = await getBalanceGameQuestions(new AbortController().signal);
    expect(loaded.map((q) => q.id)).toEqual(["Q1", "Q10"]);
    expect(loaded[0].question).toBe(questions[0].question);
    expect(loaded[0].options.map((o) => o.id)).toEqual(["A", "B", "UNKNOWN"]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/balance-game/questions",
      expect.objectContaining({ method: "GET", credentials: "omit" }),
    );
    expect(JSON.stringify(fetch.mock.calls)).not.toContain("Authorization");
  });
  it("건너뛴 문항을 빼고 answers 맵으로 결과를 요청한다", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(result));
    vi.stubGlobal("fetch", fetch);
    expect(
      await getBalanceGameResult(
        [
          { questionId: "Q1", optionId: "B" },
          { questionId: "Q10", optionId: "UNKNOWN" },
        ],
        new AbortController().signal,
      ),
    ).toEqual(result);
    expect(fetch).toHaveBeenCalledWith(
      "/api/balance-game/results",
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        body: JSON.stringify({ answers: { Q1: "B" } }),
      }),
    );
  });
  it("서버의 두 선택지 ID를 그대로 사용한다", () => {
    const q = wireQuestions.questions[0];
    expect(
      parseQuestions({
        questions: [
          {
            ...q,
            options: [
              { id: "LEFT", text: "왼쪽" },
              { id: "RIGHT", text: "오른쪽" },
            ],
          },
        ],
      })[0].options[0].id,
    ).toBe("LEFT");
  });
  it("중복 질문·선택지·잘못된 결과와 실행 가능한 이미지 주소를 거절한다", () => {
    expect(() =>
      parseQuestions({
        questions: [wireQuestions.questions[0], wireQuestions.questions[0]],
      }),
    ).toThrow();
    expect(() =>
      parseQuestions({
        questions: [
          {
            ...wireQuestions.questions[0],
            options: [
              { id: "A", text: "a" },
              { id: "A", text: "b" },
            ],
          },
        ],
      }),
    ).toThrow();
    expect(() => parseResult({ ...result, catalogItemIds: ["19"] })).toThrow();
    expect(() =>
      parseResult({ ...result, imageUrl: "javascript:alert(1)" }),
    ).toThrow();
    expect(
      parseResult({ ...result, catalogItemIds: [19, 19] }).catalogItemIds,
    ).toEqual([19]);
  });
  it("서버 오류 원문을 숨기고 호출 취소 신호를 전달한다", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("internal stack", { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    await expect(getBalanceGameQuestions(controller.signal)).rejects.toEqual(
      new BalanceGameApiError(
        500,
        0,
        "요청을 처리하지 못했어요. 다시 시도해 주세요.",
      ),
    );
    controller.abort();
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
