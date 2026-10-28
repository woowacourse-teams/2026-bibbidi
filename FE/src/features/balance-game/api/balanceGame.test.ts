import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "../../../infrastructure/http/authenticatedFetch";
import { questions, items } from "../test/fixtures";
import {
  BalanceGameApiError,
  getBalanceGameQuestions,
  getBalanceGameRecommendations,
  parseQuestions,
  parseRecommendations,
} from "./balanceGame";

vi.mock("../../../infrastructure/http/authenticatedFetch", () => ({
  authenticatedFetch: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());

describe("밸런스게임 API 계약", () => {
  it("인증 요청으로 문항을 조회하고 imagePath를 변경하지 않으며 노출 순서로 정렬한다", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      Response.json({ questions: [...questions].reverse() }),
    );
    expect(await getBalanceGameQuestions(new AbortController().signal)).toEqual(
      questions,
    );
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/balance-game/questions",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });
  it("미정 답변도 optionId UNKNOWN으로 전달하고 카탈로그 ID를 받는다", async () => {
    const answers = [
      { questionId: 1, optionId: "UNKNOWN" as const },
      { questionId: 10, optionId: "A" as const },
    ];
    vi.mocked(authenticatedFetch).mockResolvedValue(Response.json({ items }));
    expect(
      await getBalanceGameRecommendations(
        answers,
        new AbortController().signal,
      ),
    ).toEqual(items);
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/balance-game/recommendations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ answers }),
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  it("인증 오류의 숫자 코드와 공개 메시지를 유지한다", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      Response.json(
        {
          errorCode: 211,
          message: "약관에 동의해야 서비스를 이용할 수 있습니다.",
        },
        { status: 403 },
      ),
    );
    await expect(
      getBalanceGameQuestions(new AbortController().signal),
    ).rejects.toEqual(
      new BalanceGameApiError(
        403,
        211,
        "약관에 동의해야 서비스를 이용할 수 있습니다.",
      ),
    );
  });
  it("서버 오류 원문을 표시하지 않고 취소 신호를 요청에 전달한다", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response("internal stack", { status: 500 }),
    );
    const controller = new AbortController();
    await expect(getBalanceGameQuestions(controller.signal)).rejects.toThrow(
      "요청을 처리하지 못했어요",
    );
    controller.abort();
    expect(
      vi.mocked(authenticatedFetch).mock.calls[0][1]?.signal?.aborted,
    ).toBe(true);
  });
  it("빈 목록은 허용하되 잘못된 필드와 중복 문항을 거절한다", () => {
    expect(parseQuestions({ questions: [] })).toEqual([]);
    expect(parseRecommendations({ items: [] })).toEqual([]);
    expect(() =>
      parseQuestions({ questions: [questions[0], questions[0]] }),
    ).toThrow();
    expect(() =>
      parseQuestions({
        questions: [
          {
            ...questions[0],
            options: [
              { id: "A", text: "a", imageUrl: "https://example.com/a.webp" },
            ],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      parseRecommendations({ items: [{ ...items[0], catalogItemId: "19" }] }),
    ).toThrow();
  });
});
