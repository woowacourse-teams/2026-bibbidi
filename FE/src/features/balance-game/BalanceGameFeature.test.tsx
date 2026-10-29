import { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
import {
  readBalanceGameDraft,
  writeBalanceGameDraft,
} from "./model/balanceGameDraft";

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
    screen.getByRole("button", { name: questions[0].options[0].text }),
  );
  fireEvent.click(screen.getByRole("button", { name: "아직 잘 모르겠어" }));
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
  it("각 카테고리는 미담은 항목부터 3개씩 보이고 펼침·저장 후에도 담은 항목은 맨 아래에 둔다", async () => {
    const weddingTasks = Array.from({ length: 4 }, (_, index) => ({
      id: String(201 + index),
      title: `예식 추천 ${index + 1}`,
    }));
    const homeTasks = Array.from({ length: 4 }, (_, index) => ({
      id: String(205 + index),
      title: `신혼 추천 ${index + 1}`,
    }));
    mocks.getCatalog.mockResolvedValue({
      ...catalog,
      stepDetails: [
        {
          ...catalog.stepDetails[0],
          tasks: [...catalog.stepDetails[0].tasks, ...weddingTasks],
        },
        {
          ...catalog.stepDetails[1],
          tasks: [...catalog.stepDetails[1].tasks, ...homeTasks],
        },
      ],
    });
    vi.mocked(getBalanceGameResult).mockResolvedValue({
      ...result,
      catalogItemIds: [
        ...result.catalogItemIds,
        ...[...weddingTasks, ...homeTasks].map((task) => Number(task.id)),
      ],
    });
    renderGame();
    await finishGame();
    await screen.findByRole("button", { name: "10개 할 일 담기" });
    const wedding = within(screen.getByRole("region", { name: "예식" }));
    const home = within(screen.getByRole("region", { name: "신혼생활" }));
    expect(wedding.getAllByRole("listitem")).toHaveLength(3);
    expect(home.getAllByRole("listitem")).toHaveLength(3);
    expect(wedding.queryByText("이미 담음")).toBeNull();
    expect(
      wedding
        .getAllByRole("checkbox")
        .map(
          (item) => item.closest("label")?.querySelector("strong")?.textContent,
        ),
    ).toEqual(["아이폰스냅 계약", "예식 추천 1", "예식 추천 2"]);
    const more = wedding.getByRole("button", { name: "예식 더보기 (3개)" });
    expect(more.getAttribute("aria-label")).toContain(more.textContent);
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(
      home.getByRole("button", { name: "신혼생활 더보기 (2개)" }),
    ).toBeTruthy();
    fireEvent.click(wedding.getByRole("checkbox", { name: /예식 추천 1/ }));
    fireEvent.click(more);
    expect(wedding.getAllByRole("listitem")).toHaveLength(6);
    expect(home.getAllByRole("listitem")).toHaveLength(3);
    expect(wedding.getAllByRole("listitem").at(-1)?.textContent).toContain(
      "본식스냅 계약",
    );
    const hiddenChoice = wedding.getByRole("checkbox", { name: /예식 추천 3/ });
    expect((hiddenChoice as HTMLInputElement).checked).toBe(true);
    fireEvent.click(hiddenChoice);
    fireEvent.click(wedding.getByRole("button", { name: "예식 접기" }));
    expect(wedding.getAllByRole("listitem")).toHaveLength(3);
    expect(events("balance_game_task_select")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "8개 할 일 담기" }));
    await waitFor(() =>
      expect(events("balance_game_save_success")).toHaveLength(1),
    );
    expect(mocks.checklist.addCatalogItemIds).toHaveBeenCalledWith(
      "authenticated",
      ["22", "161", "202", "204", "205", "206", "207", "208"],
      expect.any(AbortSignal),
      expect.any(Function),
    );
    fireEvent.click(wedding.getByRole("button", { name: "예식 더보기 (3개)" }));
    expect(
      wedding
        .getAllByRole("listitem")
        .slice(0, 2)
        .map((item) => item.querySelector("strong")?.textContent),
    ).toEqual(["예식 추천 1", "예식 추천 3"]);
    expect(
      wedding
        .getAllByRole("listitem")
        .slice(2)
        .every((item) => item.textContent?.includes("이미 담음")),
    ).toBe(true);
  });
  it("3개 이하인 카테고리는 모든 항목을 표시하고 더보기를 제공하지 않는다", async () => {
    renderGame();
    await finishGame();
    await screen.findByRole("button", { name: "2개 할 일 담기" });
    expect(
      within(screen.getByRole("region", { name: "예식" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(2);
    expect(
      within(screen.getByRole("region", { name: "신혼생활" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /더보기/ })).toBeNull();
  });
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

  it("이동 버튼 없이 카드를 누르면 다음 질문으로 이동하고 마지막 선택을 제출한다", async () => {
    renderGame();
    await screen.findByRole("heading", { name: questions[0].question });
    expect(screen.queryByRole("button", { name: "이전 질문" })).toBeNull();
    expect(screen.queryByRole("button", { name: "다음 질문" })).toBeNull();
    expect(screen.queryByRole("button", { name: "결과 카드 보기" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: questions[0].options[0].text }),
    );
    const heading = screen.getByRole("heading", {
      name: questions[1].question,
    });
    expect(document.activeElement).toBe(heading);
    expect(getBalanceGameResult).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: questions[1].options[1].text }),
    );
    await screen.findByRole("heading", { name: result.name });
    expect(getBalanceGameResult).toHaveBeenCalledExactlyOnceWith(
      [
        { questionId: "Q1", optionId: "A" },
        { questionId: "Q10", optionId: "B" },
      ],
      expect.any(AbortSignal),
    );
    expect(events("balance_game_question_next")).toHaveLength(2);
    expect(events("balance_game_start")).toHaveLength(1);
  });
  it("결과는 앞면 이미지만 표시하며 클릭해도 제목·설명이나 뒷면이 나타나지 않는다", async () => {
    renderGame();
    await finishGame();
    const image = await screen.findByRole("img", { name: result.name });
    expect(image.getAttribute("src")).toBe(result.imageUrl);
    expect(image.closest("button")).toBeNull();
    expect(screen.queryByText(result.summary)).toBeNull();
    expect(screen.queryByText("카드를 눌러 뒤집어 보세요")).toBeNull();
    expect(screen.queryByRole("button", { name: "답변 수정하기" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "체크리스트로 이동" }),
    ).toBeNull();
    fireEvent.click(image);
    expect(screen.queryByText(result.summary)).toBeNull();
    expect(getBalanceGameResult).toHaveBeenCalledOnce();
    expect(events("balance_game_card_view")).toHaveLength(1);
  });
  it("결과 이미지를 불러오지 못해도 추천 할 일을 담을 수 있다", async () => {
    renderGame();
    await finishGame();
    const image = await screen.findByRole("img", { name: result.name });
    fireEvent.error(image);
    expect(screen.queryByRole("img", { name: result.name })).toBeNull();
    expect(screen.queryByText(result.summary)).toBeNull();
    expect(
      await screen.findByRole("button", { name: "2개 할 일 담기" }),
    ).toBeTruthy();
    expect(getBalanceGameResult).toHaveBeenCalledOnce();
  });
  it("모든 질문을 건너뛰면 빈 답변 API를 호출하지 않는다", async () => {
    renderGame();
    await screen.findByRole("heading", { name: questions[0].question });
    fireEvent.click(screen.getByRole("button", { name: "아직 잘 모르겠어" }));
    fireEvent.click(screen.getByRole("button", { name: "아직 잘 모르겠어" }));
    expect(screen.getByRole("alert").textContent).toContain("한 개 이상");
    expect(getBalanceGameResult).not.toHaveBeenCalled();
    expect(events("balance_game_answer_submit")).toHaveLength(0);
    fireEvent.click(
      screen.getByRole("button", { name: questions[1].options[0].text }),
    );
    await screen.findByRole("heading", { name: result.name });
    expect(getBalanceGameResult).toHaveBeenLastCalledWith(
      [
        { questionId: "Q1", optionId: "UNKNOWN" },
        { questionId: "Q10", optionId: "A" },
      ],
      expect.any(AbortSignal),
    );
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
    expect(screen.getByRole("status").textContent).toContain("결과를 불러오고");
    fireEvent.click(screen.getByRole("button", { name: "아직 잘 모르겠어" }));
    expect(getBalanceGameResult).toHaveBeenCalledOnce();
    await act(async () => reject(new TypeError("network-private")));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "아직 잘 모르겠어" }));
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
  it.each([false, true])(
    "질문 API를 호출하지 않고 저장된 결과·선택을 복원한다 (StrictMode: %s)",
    async (strict) => {
      writeBalanceGameDraft({
        result,
        answers: [{ questionId: "Q1", optionId: "A" }],
        selectedIds: [22],
        tracking: {
          runId: "restored-run",
          resultId: "restored-result",
          started: true,
          answerRevision: 1,
        },
      });
      vi.mocked(getBalanceGameQuestions).mockRejectedValue(
        new TypeError("questions unavailable"),
      );

      renderGame("authenticated", strict);

      await screen.findByRole("button", { name: "1개 할 일 담기" });
      expect(screen.getByRole("img", { name: result.name })).toBeTruthy();
      expect(
        (
          screen.getByRole("checkbox", {
            name: /아이폰스냅 계약/,
          }) as HTMLInputElement
        ).checked,
      ).toBe(true);
      expect(
        (
          screen.getByRole("checkbox", {
            name: /신혼집 후보 조사/,
          }) as HTMLInputElement
        ).checked,
      ).toBe(false);
      expect(getBalanceGameQuestions).not.toHaveBeenCalled();
      expect(getBalanceGameResult).not.toHaveBeenCalled();
      expect(events("balance_game_card_view")).toHaveLength(1);
      expect(events("balance_game_recommendation_view")).toHaveLength(1);
      expect(readBalanceGameDraft()).toBeUndefined();
    },
  );
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
    expect(getBalanceGameQuestions).toHaveBeenCalledOnce();
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
    const storageWrite = vi
      .spyOn(Object.getPrototypeOf(window.sessionStorage), "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    fireEvent.click(button);
    expect(storageWrite).toHaveBeenCalledOnce();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "선택을 보관하지 못했어요",
    );
    expect(loginRequired).not.toHaveBeenCalled();
  });
});
