import { describe, expect, it, vi } from "vitest";
import { createBalanceGameTracking } from "./balanceGameTracking";
import { questions } from "../test/fixtures";

describe("문항별 활성 시간", () => {
  it("탭을 숨긴 시간과 API 대기를 제외하고 되돌아가기는 새 방문으로 기록한다", () => {
    let time = 0;
    let sequence = 0;
    const track = vi.fn();
    const tracking = createBalanceGameTracking({
      authState: "guest",
      now: () => time,
      id: () => `id-${++sequence}`,
      track,
    });
    tracking.showQuestion(questions[0], 0, 2, "initial");
    time = 100;
    tracking.setVisible(false);
    time = 10100;
    tracking.setVisible(true);
    time = 10300;
    tracking.select("A", undefined);
    expect(track.mock.calls.at(-1)![0].parameters.active_elapsed_ms).toBe(300);
    time = 10400;
    tracking.next();
    time = 20000;
    tracking.next();
    expect(
      track.mock.calls.filter(([e]) => e.name === "balance_game_question_next"),
    ).toHaveLength(1);
    tracking.showQuestion(questions[1], 1, 2, "next");
    time = 20100;
    tracking.showQuestion(questions[0], 0, 2, "previous");
    time = 20200;
    tracking.select("B", "A");
    expect(track.mock.calls.at(-1)![0].parameters).toMatchObject({
      active_elapsed_ms: 100,
      is_change: true,
      is_first_selection: false,
    });
    const visits = track.mock.calls.filter(
      ([e]) => e.name === "balance_game_question_view",
    );
    expect(visits[0][0].parameters.question_visit_id).not.toBe(
      visits[2][0].parameters.question_visit_id,
    );
  });
  it("StrictMode의 pause/resume에서 방문을 중복 기록하지 않고 계측 오류를 격리한다", () => {
    const track = vi.fn();
    const tracking = createBalanceGameTracking({ authState: "guest", track });
    tracking.showQuestion(questions[0], 0, 2, "initial");
    tracking.pause();
    tracking.resume();
    tracking.showQuestion(questions[0], 0, 2, "initial");
    expect(track).toHaveBeenCalledOnce();
    track.mockImplementation(() => {
      throw new Error("SDK");
    });
    expect(() => tracking.select("A", undefined)).not.toThrow();
  });
  it("같은 답변으로 결과를 다시 받아도 요청별로 구분하고 로그인 복귀는 중복 집계하지 않는다", () => {
    const track = vi.fn();
    const tracking = createBalanceGameTracking({ authState: "guest", track });
    tracking.cardShown("LUXURY", 120, "result-one");
    tracking.cardShown("LUXURY", 120, "result-one");
    tracking.cardShown("LUXURY", 200, "result-two");
    const restored = createBalanceGameTracking({
      authState: "authenticated",
      track,
      restored: tracking.snapshot(),
    });
    restored.cardShown("LUXURY", 0, "result-two");
    expect(
      track.mock.calls.filter(([e]) => e.name === "balance_game_card_view"),
    ).toHaveLength(2);
    restored.showQuestion(questions[0], 0, 2, "edit");
    expect(track.mock.calls.at(-1)![0].parameters).not.toHaveProperty(
      "card_type",
    );
  });
});
