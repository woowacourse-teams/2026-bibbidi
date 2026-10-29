import { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreparationAuthenticationRequiredError } from "../preparation";
import { BalanceGameFeature } from "./BalanceGameFeature";
import {
  BalanceGameApiError,
  getBalanceGameQuestions,
  getBalanceGameResult,
} from "./api/balanceGame";
import { catalog, questions, result } from "./test/fixtures";
import { readBalanceGameDraft } from "./model/balanceGameDraft";

const mocks = vi.hoisted(() => ({
  checklist: { getCatalogItemIds: vi.fn(), addCatalogItemIds: vi.fn() },
  query: { refresh: vi.fn() },
  getCatalog: vi.fn(),
  track: vi.fn(),
}));
vi.mock("../../infrastructure/analytics", () => ({
  analytics: { track: mocks.track },
}));
vi.mock("./api/balanceGame", async (original) => ({
  ...(await original<typeof import("./api/balanceGame")>()),
  getBalanceGameQuestions: vi.fn(),
  getBalanceGameResult: vi.fn(),
}));
vi.mock("../catalog", () => ({
  catalogRepository: { getCatalog: mocks.getCatalog },
}));
vi.mock("../preparation", async (original) => ({
  ...(await original<typeof import("../preparation")>()),
  usePreparationChecklistRepository: () => mocks.checklist,
}));
vi.mock("../checklist", async (original) => ({
  ...(await original<typeof import("../checklist")>()),
  useMyChecklistQueryRepository: () => mocks.query,
}));
const authRequired = vi.fn();
const loginRequired = vi.fn();
function renderGame(
  audience: "guest" | "authenticated" = "authenticated",
  strict = false,
) {
  const game = (
    <MemoryRouter>
      <BalanceGameFeature
        audience={audience}
        onAuthenticationRequired={authRequired}
        onLoginRequired={loginRequired}
      />
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{game}</StrictMode> : game);
}
async function finishGame() {
  await screen.findByRole("heading", { name: questions[0].question });
  fireEvent.click(
    screen.getByRole("radio", { name: questions[0].options[0].text }),
  );
  fireEvent.click(screen.getByRole("button", { name: "다음 질문" }));
  fireEvent.click(screen.getByRole("radio", { name: "아직 잘 모르겠어" }));
  fireEvent.click(screen.getByRole("button", { name: "결과 카드 보기" }));
}
const events = (name: string) =>
  mocks.track.mock.calls
    .map(([event]) => event)
    .filter((event) => event.name === name);
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.mocked(getBalanceGameQuestions).mockResolvedValue(questions);
  vi.mocked(getBalanceGameResult).mockResolvedValue(result);
  mocks.getCatalog.mockResolvedValue(catalog);
  mocks.checklist.getCatalogItemIds.mockResolvedValue(["19"]);
  mocks.checklist.addCatalogItemIds.mockImplementation(
    (_audience, ids: string[], _signal, onCreated) => {
      onCreated?.(
        ids.map((id) => ({ id: 1000 + Number(id), catalogItemId: Number(id) })),
      );
      return Promise.resolve(ids);
    },
  );
});
afterEach(() => vi.restoreAllMocks());

describe("공개 밸런스게임과 행동 계측", () => {
  it("저장 중 인증이 만료되어도 현재 결과와 최종 선택을 보관한다", async () => {
    mocks.checklist.addCatalogItemIds.mockRejectedValue(
      new PreparationAuthenticationRequiredError(),
    );
    renderGame();
    await finishGame();
    fireEvent.click(
      await screen.findByRole("button", { name: "2개 할 일 담기" }),
    );
    await waitFor(() => expect(authRequired).toHaveBeenCalledOnce());
    expect(readBalanceGameDraft()).toMatchObject({
      result,
      selectedIds: [22, 161],
    });
    expect(events("balance_game_save_success")).toHaveLength(0);
  });

  it("선택 전 다음을 막고 이전 답을 유지하며 선택을 바꾼다", async () => {
    renderGame();
    await screen.findByRole("heading", { name: questions[0].question });
    expect(
      (screen.getByRole("button", { name: "다음 질문" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("radio", { name: questions[0].options[0].text }),
    );
    fireEvent.click(screen.getByRole("button", { name: "다음 질문" }));
    fireEvent.click(screen.getByRole("button", { name: "이전 질문" }));
    expect(
      (
        screen.getByRole("radio", {
          name: questions[0].options[0].text,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "아직 잘 모르겠어" }));
    expect(events("balance_game_start")).toHaveLength(1);
    expect(
      events("balance_game_answer_select").at(-1).parameters,
    ).toMatchObject({
      question_id: "Q1",
      option_id: "UNKNOWN",
      is_change: true,
      is_first_selection: false,
    });
    expect(
      events("balance_game_question_view").at(-1).parameters.visit_reason,
    ).toBe("previous");
  });
  it("모든 질문을 건너뛰면 빈 답변 API를 호출하지 않는다", async () => {
    renderGame();
    await screen.findByRole("heading", { name: questions[0].question });
    fireEvent.click(screen.getByRole("radio", { name: "아직 잘 모르겠어" }));
    fireEvent.click(screen.getByRole("button", { name: "다음 질문" }));
    fireEvent.click(screen.getByRole("radio", { name: "아직 잘 모르겠어" }));
    fireEvent.click(screen.getByRole("button", { name: "결과 카드 보기" }));
    expect(screen.getByRole("alert").textContent).toContain("한 개 이상");
    expect(getBalanceGameResult).not.toHaveBeenCalled();
    expect(events("balance_game_answer_submit")).toHaveLength(0);
  });
  it("문항 실패를 재시도하며 오류 원문을 분석에 보내지 않는다", async () => {
    vi.mocked(getBalanceGameQuestions).mockRejectedValueOnce(
      new BalanceGameApiError(503, 500, "private-error-secret"),
    );
    renderGame();
    await screen.findByRole("alert");
    expect(authRequired).not.toHaveBeenCalled();
    expect(events("balance_game_error")[0].parameters).toMatchObject({
      stage: "questions",
      failure_kind: "api",
    });
    expect(JSON.stringify(mocks.track.mock.calls)).not.toContain(
      "private-error-secret",
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByRole("heading", { name: questions[0].question });
  });
  it("제출 실패 후 답변을 유지하고 중복 제출을 막으며 같은 답변 회차로 재시도한다", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(getBalanceGameResult).mockImplementationOnce(
      () =>
        new Promise((_resolve, rejectPromise) => {
          reject = rejectPromise;
        }),
    );
    renderGame();
    await finishGame();
    fireEvent.click(screen.getByRole("button", { name: "결과 카드 보기" }));
    expect(getBalanceGameResult).toHaveBeenCalledOnce();
    await act(async () => reject(new TypeError("network-private")));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "결과 카드 보기" }));
    await screen.findByRole("heading", { name: result.name });
    expect(getBalanceGameResult).toHaveBeenLastCalledWith(
      [
        { questionId: "Q1", optionId: "A" },
        { questionId: "Q10", optionId: "UNKNOWN" },
      ],
      expect.any(AbortSignal),
    );
    const submits = events("balance_game_answer_submit");
    expect(submits[0].parameters.answer_revision).toBe(
      submits[1].parameters.answer_revision,
    );
    expect(submits[0].parameters.attempt_id).not.toBe(
      submits[1].parameters.attempt_id,
    );
    expect(events("balance_game_card_view")).toHaveLength(1);
  });
  it("StrictMode에서도 첫 문항·카드·추천 노출을 중복 기록하지 않고 기본 선택은 조작으로 세지 않는다", async () => {
    renderGame("guest", true);
    await finishGame();
    await screen.findByRole("button", { name: "로그인하고 2개 할 일 담기" });
    expect(events("balance_game_question_view")).toHaveLength(2);
    expect(events("balance_game_card_view")).toHaveLength(1);
    expect(events("balance_game_recommendation_view")).toHaveLength(1);
    expect(events("balance_game_task_select")).toHaveLength(0);
    expect(mocks.checklist.getCatalogItemIds).toHaveBeenCalledWith(
      "guest",
      expect.any(AbortSignal),
    );
    expect(
      events("balance_game_recommendation_view")[0].parameters,
    ).toMatchObject({
      card_type: "LUXURY",
      recommended_count: 3,
      eligible_count: 2,
      already_existing_count: 1,
    });
    const payload = JSON.stringify(mocks.track.mock.calls);
    expect(payload).not.toContain(questions[0].question);
    expect(payload).not.toContain(result.summary);
  });
  it("해제 후 재선택을 최종 제외로 세지 않고 후보별 최종 상태와 실제 생성 ID를 기록한다", async () => {
    renderGame();
    await finishGame();
    await screen.findByRole("button", { name: "2개 할 일 담기" });
    const iphone = screen.getByRole("checkbox", { name: /아이폰스냅 계약/ });
    fireEvent.click(iphone);
    fireEvent.click(iphone);
    fireEvent.click(screen.getByRole("checkbox", { name: /신혼집 후보 조사/ }));
    fireEvent.click(screen.getByRole("button", { name: "1개 할 일 담기" }));
    await waitFor(() =>
      expect(events("balance_game_save_success")).toHaveLength(1),
    );
    expect(events("balance_game_task_select")).toHaveLength(3);
    expect(
      events("balance_game_task_decision").map((e) => [
        e.parameters.catalog_item_id,
        e.parameters.selected,
      ]),
    ).toEqual([
      [22, true],
      [161, false],
    ]);
    expect(events("balance_game_save_success")[0].parameters).toMatchObject({
      created_count: 1,
      card_type: "LUXURY",
      origin: "balance_game",
    });
    expect(events("balance_game_task_created")[0].parameters).toMatchObject({
      checklist_item_id: 1022,
      catalog_item_id: 22,
      card_type: "LUXURY",
    });
  });
  it("저장 실패를 성공으로 세지 않고 재시도의 생성 결과만 기록한다", async () => {
    mocks.checklist.addCatalogItemIds.mockRejectedValueOnce(
      new TypeError("private-network"),
    );
    renderGame();
    await finishGame();
    fireEvent.click(
      await screen.findByRole("button", { name: "2개 할 일 담기" }),
    );
    await screen.findByRole("alert");
    expect(events("balance_game_save_success")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "2개 할 일 담기" }));
    await waitFor(() =>
      expect(events("balance_game_save_success")).toHaveLength(1),
    );
    expect(events("balance_game_save_submit")).toHaveLength(2);
    expect(
      events("balance_game_save_success")[0].parameters.created_count,
    ).toBe(2);
    expect(events("balance_game_error").at(-1).parameters.stage).toBe("save");
  });
  it("다른 요청이 먼저 추가한 항목은 생성 0건으로 구분한다", async () => {
    mocks.checklist.getCatalogItemIds
      .mockResolvedValueOnce(["19"])
      .mockResolvedValue(["19", "22", "161"]);
    renderGame();
    await finishGame();
    fireEvent.click(
      await screen.findByRole("button", { name: "2개 할 일 담기" }),
    );
    await waitFor(() =>
      expect(events("balance_game_save_success")).toHaveLength(1),
    );
    expect(
      events("balance_game_save_success")[0].parameters.created_count,
    ).toBe(0);
    expect(events("balance_game_task_created")).toHaveLength(0);
    expect(mocks.checklist.addCatalogItemIds).not.toHaveBeenCalled();
  });
  it("로그인 전에는 저장 API를 호출하지 않고 결과·선택·플레이 ID를 로그인 후 복원한다", async () => {
    const guest = renderGame("guest");
    await finishGame();
    await screen.findByRole("button", { name: "로그인하고 2개 할 일 담기" });
    fireEvent.click(screen.getByRole("checkbox", { name: /신혼집 후보 조사/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "로그인하고 1개 할 일 담기" }),
    );
    expect(loginRequired).toHaveBeenCalledOnce();
    expect(mocks.checklist.addCatalogItemIds).not.toHaveBeenCalled();
    expect(events("balance_game_save_submit")).toHaveLength(0);
    const draft = readBalanceGameDraft()!;
    expect(draft.selectedIds).toEqual([22]);
    guest.unmount();
    renderGame("authenticated");
    await screen.findByRole("button", { name: "1개 할 일 담기" });
    expect(getBalanceGameResult).toHaveBeenCalledOnce();
    expect(events("balance_game_start")).toHaveLength(1);
    expect(events("balance_game_card_view")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "1개 할 일 담기" }));
    await waitFor(() =>
      expect(events("balance_game_save_success")).toHaveLength(1),
    );
    expect(events("balance_game_save_success")[0].parameters.game_run_id).toBe(
      draft.tracking.runId,
    );
  });
  it("저장소 실패 시 선택을 잃은 채 로그인으로 이동하지 않는다", async () => {
    renderGame("guest");
    await finishGame();
    const button = await screen.findByRole("button", {
      name: "로그인하고 2개 할 일 담기",
    });
    vi.spyOn(window.Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    fireEvent.click(button);
    expect(screen.getByRole("alert").textContent).toContain(
      "선택을 보관하지 못했어요",
    );
    expect(loginRequired).not.toHaveBeenCalled();
  });
});
