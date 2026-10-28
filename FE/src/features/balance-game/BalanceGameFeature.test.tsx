import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BalanceGameFeature } from "./BalanceGameFeature";
import {
  BalanceGameApiError,
  getBalanceGameQuestions,
  getBalanceGameRecommendations,
} from "./api/balanceGame";
import { questions, items } from "./test/fixtures";

const repositories = vi.hoisted(() => ({
  checklist: { getCatalogItemIds: vi.fn(), addCatalogItemIds: vi.fn() },
  query: { refresh: vi.fn() },
}));
vi.mock("./api/balanceGame", async (original) => ({
  ...(await original<typeof import("./api/balanceGame")>()),
  getBalanceGameQuestions: vi.fn(),
  getBalanceGameRecommendations: vi.fn(),
}));
vi.mock("../preparation", async (original) => ({
  ...(await original<typeof import("../preparation")>()),
  usePreparationChecklistRepository: () => repositories.checklist,
}));
vi.mock("../checklist", async (original) => ({
  ...(await original<typeof import("../checklist")>()),
  useMyChecklistQueryRepository: () => repositories.query,
}));
const authRequired = vi.fn();

function renderGame() {
  return render(
    <MemoryRouter>
      <BalanceGameFeature onAuthenticationRequired={authRequired} />
    </MemoryRouter>,
  );
}
async function finishGame() {
  await screen.findByRole("heading", { name: questions[0].question });
  fireEvent.click(
    screen.getByRole("radio", { name: questions[0].options[0].text }),
  );
  fireEvent.click(screen.getByRole("button", { name: "다음 질문" }));
  fireEvent.click(screen.getByRole("radio", { name: "아직 잘 모르겠어" }));
  fireEvent.click(screen.getByRole("button", { name: "추천 할 일 보기" }));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBalanceGameQuestions).mockResolvedValue(questions);
  vi.mocked(getBalanceGameRecommendations).mockResolvedValue(items);
  repositories.checklist.getCatalogItemIds.mockResolvedValue(["19"]);
  repositories.checklist.addCatalogItemIds.mockImplementation(
    (_audience, ids: string[]) => Promise.resolve(ids),
  );
});

describe("밸런스게임", () => {
  it("선택 전 다음을 막고 이전 답을 유지하며 선택을 바꿀 수 있다", async () => {
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
    expect(
      (
        screen.getByRole("radio", {
          name: questions[0].options[0].text,
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });
  it("이미지 실패나 null이어도 선택할 수 있고 미정에는 이미지를 렌더링하지 않는다", async () => {
    const { container } = renderGame();
    await screen.findByRole("heading", { name: questions[0].question });
    expect(container.querySelector(".balance-game__unknown img")).toBeNull();
    const image = container.querySelector("img")!;
    fireEvent.error(image);
    expect(container.contains(image)).toBe(false);
    fireEvent.click(screen.getByRole("radio", { name: "아직 잘 모르겠어" }));
    fireEvent.click(screen.getByRole("button", { name: "다음 질문" }));
    expect(container.querySelectorAll("img").length).toBe(1);
  });
  it("문항 조회 실패를 재시도하고 인증 오류는 인증 상태를 갱신한다", async () => {
    vi.mocked(getBalanceGameQuestions).mockRejectedValueOnce(
      new BalanceGameApiError(401, 201, "로그인이 필요합니다."),
    );
    renderGame();
    await screen.findByRole("alert");
    expect(authRequired).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(
      await screen.findByRole("heading", { name: questions[0].question }),
    ).toBeTruthy();
  });
  it("제출 실패 후 답변을 유지하고 중복 제출을 막으며 다시 시도한다", async () => {
    let rejectRequest!: (reason: Error) => void;
    vi.mocked(getBalanceGameRecommendations).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    renderGame();
    await finishGame();
    fireEvent.click(screen.getByRole("button", { name: "추천 할 일 보기" }));
    expect(getBalanceGameRecommendations).toHaveBeenCalledOnce();
    await act(async () => rejectRequest(new Error("network")));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      (
        screen.getByRole("radio", {
          name: "아직 잘 모르겠어",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "추천 할 일 보기" }));
    await screen.findByRole("heading", { name: /우리에게 맞는/ });
    expect(getBalanceGameRecommendations).toHaveBeenLastCalledWith(
      [
        { questionId: 1, optionId: "A" },
        { questionId: 10, optionId: "UNKNOWN" },
      ],
      expect.any(AbortSignal),
    );
  });
  it("기존 항목을 제외해 선택하고 저장 실패 후 재시도하며 중복 담기를 막는다", async () => {
    repositories.checklist.addCatalogItemIds.mockRejectedValueOnce(
      new Error("network"),
    );
    renderGame();
    await finishGame();
    const save = await screen.findByRole("button", { name: "2개 할 일 담기" });
    fireEvent.click(save);
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "2개 할 일 담기" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "2개 할 일 담기" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "모든 할 일을 담았어요" }),
      ).toBeTruthy(),
    );
    expect(repositories.checklist.addCatalogItemIds).toHaveBeenLastCalledWith(
      "authenticated",
      ["22", "161"],
      expect.any(AbortSignal),
    );
  });
  it("나가기 전에 답변 삭제를 알리고 계속 고를 수 있다", async () => {
    renderGame();
    await screen.findByRole("heading", { name: questions[0].question });
    fireEvent.click(screen.getByRole("radio", { name: "아직 잘 모르겠어" }));
    fireEvent.click(screen.getByRole("button", { name: "나가기" }));
    expect(
      await screen.findByRole("dialog", { name: "밸런스게임을 나갈까요?" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "계속 고르기" }));
    expect(
      (
        screen.getByRole("radio", {
          name: "아직 잘 모르겠어",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });
});
