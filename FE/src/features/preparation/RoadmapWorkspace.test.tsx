import {
  fireEvent,
  cleanup,
  act,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthState } from "../auth/model/auth";
import { ChecklistQueryModel } from "../checklist/model/checklistQuery";

const mocks = vi.hoisted(() => ({
  authState: {
    status: "authenticated",
    user: { id: 1, nickname: "비비디" },
  } as AuthState,
  getChecklist: vi.fn(),
  refreshAuth: vi.fn(),
  getCatalog: vi.fn(),
  getCatalogItemIds: vi.fn(),
  addCatalogItemIds: vi.fn(),
  revision: 0,
}));
vi.mock("../auth", () => ({
  useAuth: () => ({
    authState: mocks.authState,
    refreshAuth: mocks.refreshAuth,
  }),
}));
vi.mock("../checklist/checklistQueryDependencies", () => {
  const repository = { getChecklist: mocks.getChecklist };
  return {
    useChecklistQueryRepository: () => repository,
    useChecklistRevision: () => mocks.revision,
  };
});
vi.mock("./preparationDependencies", () => {
  const repository = {
    getCatalogItemIds: mocks.getCatalogItemIds,
    addCatalogItemIds: mocks.addCatalogItemIds,
  };
  return {
    preparationCatalogRepository: { getCatalog: mocks.getCatalog },
    usePreparationChecklistRepository: () => repository,
  };
});
vi.mock("../../infrastructure/analytics", () => ({
  analytics: { track: vi.fn() },
}));

import { PreparationRoadmapFeature } from "./PreparationRoadmapFeature";
import { preparationCatalogFixture } from "./test/fixtures/preparationCatalog.fixture";
import { ChecklistQueryAuthenticationRequiredError } from "../checklist/repository/checklistQueryRepository";

function item(id: number, title: string, custom = false) {
  return {
    appointments: [],
    categoryId: "wedding-hall",
    checklistItemId: id,
    id: `checklist-item-${id}`,
    sourceCatalogItemId: custom ? null : 101,
    createdAt: "2026-10-08T00:00:00",
    status: "prev" as const,
    title,
  };
}
const checklist: ChecklistQueryModel = {
  categories: [
    {
      id: "wedding-hall",
      title: "웨딩홀",
      items: [],
      steps: [
        {
          id: "step-1",
          order: 1,
          title: "웨딩홀 투어와 계약",
          items: [item(1, "내 웨딩홀 투어")],
        },
        { id: "step-2", order: 2, title: "예식 형태 결정", items: [] },
      ],
      customItems: [item(2, "우리만의 준비", true)],
    },
    {
      id: "studio-dress-makeup",
      title: "스드메",
      items: [],
      steps: [],
      customItems: [],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authState = {
    status: "authenticated",
    user: { id: 1, nickname: "비비디" },
  };
  mocks.revision = 0;
  mocks.getChecklist.mockResolvedValue(checklist);
  mocks.getCatalog.mockResolvedValue(preparationCatalogFixture);
  mocks.getCatalogItemIds.mockResolvedValue(["101"]);
  mocks.addCatalogItemIds.mockImplementation((_audience, ids) =>
    Promise.resolve(ids),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function showChatRecommendations() {
  fireEvent.click(
    screen.getByRole("button", { name: "웨딩홀을 정한 다음엔 뭘 준비할까?" }),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "추가하고 싶은 일" }), {
    target: { value: "추천해줘" },
  });
  fireEvent.click(screen.getByRole("button", { name: "메시지 전송" }));
}

function showAll() {
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "로드맵 보기" })).getByRole(
      "button",
      { name: "전체 단계" },
    ),
  );
}

describe("준비 로드맵 보기 전환", () => {
  it("인증 확인 후 같은 사용자로 복귀해도 완료한 추천을 다시 타이핑하지 않는다", async () => {
    const { rerender } = render(<PreparationRoadmapFeature />);
    await screen.findByText("내 웨딩홀 투어");
    vi.useFakeTimers();
    showChatRecommendations();
    fireEvent.click(screen.getByRole("button", { name: "추가하기 →" }));
    act(() => vi.advanceTimersByTime(1300));
    const owner = mocks.authState;
    mocks.authState = { status: "loading" };
    rerender(<PreparationRoadmapFeature />);
    expect(screen.queryByRole("region", { name: "예시로 담은 일" })).toBeNull();
    mocks.authState = owner;
    await act(async () => {
      rerender(<PreparationRoadmapFeature />);
    });
    const preview = screen.getByRole("region", { name: "예시로 담은 일" });
    expect(
      within(preview).getByText("주례 없는 예식 순서 정하기"),
    ).toBeTruthy();
    expect(preview.querySelector(".ai-task-preview__cursor")).toBeNull();
    act(() => vi.advanceTimersByTime(1300));
    expect(
      within(preview).getByText("주례 없는 예식 순서 정하기"),
    ).toBeTruthy();
  });

  it("인증 확인 후 채팅이 다시 생성되어도 기존 추천을 중복 추가하지 않는다", async () => {
    const { rerender } = render(<PreparationRoadmapFeature />);
    await screen.findByText("내 웨딩홀 투어");
    vi.useFakeTimers();
    showChatRecommendations();
    fireEvent.click(screen.getByRole("button", { name: "추가하기 →" }));
    const owner = mocks.authState;
    mocks.authState = { status: "loading" };
    rerender(<PreparationRoadmapFeature />);
    mocks.authState = owner;
    await act(async () => {
      rerender(<PreparationRoadmapFeature />);
    });
    showChatRecommendations();
    fireEvent.click(screen.getByRole("button", { name: "추가하기 →" }));
    const preview = screen.getByRole("region", { name: "예시로 담은 일" });
    expect(within(preview).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("log").textContent).toContain(
      "이미 예시로 추가했어요",
    );
    expect(mocks.addCatalogItemIds).not.toHaveBeenCalled();
  });

  it("실제 사용자가 바뀌면 추가 목록과 완료 기록을 함께 초기화한다", async () => {
    const { rerender } = render(<PreparationRoadmapFeature />);
    await screen.findByText("내 웨딩홀 투어");
    vi.useFakeTimers();
    showChatRecommendations();
    fireEvent.click(screen.getByRole("button", { name: "추가하기 →" }));
    act(() => vi.advanceTimersByTime(1300));
    const owner = mocks.authState;
    mocks.authState = {
      status: "authenticated",
      user: { id: 2, nickname: "다른 사용자" },
    };
    await act(async () => {
      rerender(<PreparationRoadmapFeature />);
    });
    expect(screen.queryByRole("region", { name: "예시로 담은 일" })).toBeNull();
    mocks.authState = owner;
    await act(async () => {
      rerender(<PreparationRoadmapFeature />);
    });
    expect(screen.queryByRole("region", { name: "예시로 담은 일" })).toBeNull();
    showChatRecommendations();
    fireEvent.click(screen.getByRole("button", { name: "추가하기 →" }));
    const preview = screen.getByRole("region", { name: "예시로 담은 일" });
    expect(within(preview).getAllByRole("listitem")).toHaveLength(1);
    expect(
      within(preview).queryByText("주례 없는 예식 순서 정하기"),
    ).toBeNull();
    act(() => vi.advanceTimersByTime(1300));
    expect(
      within(preview).getByText("주례 없는 예식 순서 정하기"),
    ).toBeTruthy();
  });

  it("PC 추천 추가는 예시 리스트에서 타이핑하고 저장된 내 할 일과 브라우저 저장소를 바꾸지 않는다", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<PreparationRoadmapFeature />);
    await screen.findByText("내 웨딩홀 투어");
    vi.useFakeTimers();
    showChatRecommendations();
    fireEvent.click(screen.getByRole("button", { name: "추가하기 →" }));
    const preview = screen.getByRole("region", { name: "예시로 담은 일" });
    const row = within(preview).getByRole("listitem", {
      name: "주례 없는 예식 순서 정하기",
    });
    expect(document.activeElement).toBe(row);
    expect(
      within(preview).queryByText("주례 없는 예식 순서 정하기"),
    ).toBeNull();
    act(() => vi.advanceTimersByTime(1300));
    expect(
      within(preview).getByText("주례 없는 예식 순서 정하기"),
    ).toBeTruthy();
    expect(screen.getByText("2개 단계 · 내 할 일 2개 · 완료 0개")).toBeTruthy();
    expect(mocks.addCatalogItemIds).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  });

  it("모바일에서 연속 선택한 뒤 보기 버튼으로 예시 리스트에 포커스를 넘기고 순서대로 쓴다", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(max-width: 760px)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const descriptors = Object.getOwnPropertyDescriptors(
      HTMLDialogElement.prototype,
    );
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.setAttribute("open", "");
        },
      },
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.removeAttribute("open");
        },
      },
    });
    try {
      const { rerender } = render(<PreparationRoadmapFeature />);
      await screen.findByText("내 웨딩홀 투어");
      vi.useFakeTimers();
      fireEvent.click(screen.getByRole("button", { name: "AI 채팅 열기" }));
      showChatRecommendations();
      fireEvent.click(screen.getByRole("button", { name: "추가하기 →" }));
      fireEvent.click(screen.getByRole("button", { name: "추가하기 →" }));
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(
        screen.queryByRole("region", { name: "예시로 담은 일" }),
      ).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "추가한 할 일 2개 보기" }),
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      const preview = screen.getByRole("region", { name: "예시로 담은 일" });
      const rows = within(preview).getAllByRole("listitem");
      await act(async () => {
        await Promise.resolve();
      });
      expect(document.activeElement).toBe(rows[0]);
      act(() => vi.advanceTimersByTime(1300));
      expect(
        within(preview).getByText("주례 없는 예식 순서 정하기"),
      ).toBeTruthy();
      expect(
        within(preview).queryByText("사회자·축가 맡을 사람 정하기"),
      ).toBeNull();
      act(() => vi.advanceTimersByTime(1300));
      expect(
        within(preview).getByText("사회자·축가 맡을 사람 정하기"),
      ).toBeTruthy();
      expect(mocks.addCatalogItemIds).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "AI 채팅 열기" }));
      expect(screen.getByText("추천 할 일을 모두 확인했어요.")).toBeTruthy();
      const owner = mocks.authState;
      mocks.authState = { status: "loading" };
      rerender(<PreparationRoadmapFeature />);
      mocks.authState = owner;
      await act(async () => {
        rerender(<PreparationRoadmapFeature />);
      });
      expect(screen.getByRole("dialog")).toBeTruthy();
      fireEvent.click(
        screen.getByRole("button", { name: "추가한 할 일 2개 보기" }),
      );
      const restoredPreview = screen.getByRole("region", {
        name: "예시로 담은 일",
      });
      expect(
        within(restoredPreview).getByText("주례 없는 예식 순서 정하기"),
      ).toBeTruthy();
      expect(
        within(restoredPreview).getByText("사회자·축가 맡을 사람 정하기"),
      ).toBeTruthy();
      expect(
        restoredPreview.querySelector(".ai-task-preview__cursor"),
      ).toBeNull();
    } finally {
      cleanup();
      for (const method of ["showModal", "close"] as const) {
        if (descriptors[method])
          Object.defineProperty(
            HTMLDialogElement.prototype,
            method,
            descriptors[method],
          );
        else
          delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)[
            method
          ];
      }
    }
  });

  it("비로그인도 채팅을 사용하고 카테고리·로드맵 보기 전환 중 대화를 유지한다", async () => {
    mocks.authState = { status: "guest" };
    render(<PreparationRoadmapFeature />);
    await screen.findByRole("button", { name: "01 웨딩홀 투어와 계약" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "웨딩홀을 정한 다음엔 뭘 준비할까?",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "스드메" }));
    expect(screen.getByRole("log").textContent).toContain(
      "다음으로 준비하면 좋은 일",
    );
    fireEvent.click(screen.getByRole("button", { name: "내 로드맵" }));
    expect(screen.getByRole("link", { name: "로그인" })).toBeTruthy();
    expect(screen.getByRole("log").textContent).toContain(
      "다음으로 준비하면 좋은 일",
    );
    expect(mocks.addCatalogItemIds).not.toHaveBeenCalled();
  });

  it("상단 현황은 빈 단계를 포함하고 직접 추가한 일과 완료 상태를 집계한다", async () => {
    mocks.getChecklist.mockResolvedValue({
      categories: [
        {
          ...checklist.categories[0],
          customItems: [{ ...item(2, "우리만의 준비", true), status: "done" }],
        },
        checklist.categories[1],
      ],
    });
    render(<PreparationRoadmapFeature />);
    await screen.findByText("2개 단계 · 내 할 일 2개 · 완료 1개");
    showAll();
    await screen.findByText(/내 할 일 2개 · 완료 1개/);
    fireEvent.click(screen.getByRole("button", { name: "스드메" }));
    await screen.findByText(/내 할 일 0개 · 완료 0개/);
  });

  it("각 카드에 완료 상태와 일정을 조회용으로 표시하고 변경 뒤 갱신한다", async () => {
    mocks.getChecklist.mockResolvedValue({
      categories: [
        {
          ...checklist.categories[0],
          customItems: [{ ...item(2, "우리만의 준비", true), status: "done" }],
        },
      ],
    });
    const { rerender } = render(<PreparationRoadmapFeature />);
    const card = await screen.findByRole("article", { name: "내가 추가한 일" });
    expect(within(card).getByText("내 할 일 1개 · 완료 1개")).toBeTruthy();
    expect(within(card).getByText("완료 · 일정 없음")).toBeTruthy();
    expect(within(card).queryByRole("checkbox")).toBeNull();
    expect(within(card).queryByRole("button")).toBeNull();
    mocks.getChecklist.mockResolvedValue(checklist);
    mocks.revision += 1;
    rerender(<PreparationRoadmapFeature />);
    const refreshedCard = await screen.findByRole("article", {
      name: "내가 추가한 일",
    });
    expect(
      within(refreshedCard).getByText("내 할 일 1개 · 완료 0개"),
    ).toBeTruthy();
    expect(within(refreshedCard).getByText("예정 · 일정 없음")).toBeTruthy();
  });

  it("전체 단계의 준비 현황은 체크리스트 변경 뒤 다시 조회한다", async () => {
    const { rerender } = render(<PreparationRoadmapFeature />);
    await screen.findByRole("heading", { name: "웨딩홀 로드맵" });
    showAll();
    await screen.findByText(/내 할 일 2개 · 완료 0개/);
    mocks.getChecklist.mockResolvedValue({
      categories: [{ ...checklist.categories[0], steps: [], customItems: [] }],
    });
    mocks.revision += 1;
    rerender(<PreparationRoadmapFeature />);
    await screen.findByText(/내 할 일 0개 · 완료 0개/);
  });

  it("로그인 사용자는 개인 할 일이 있는 단계와 직접 추가 그룹만 확인한다", async () => {
    render(<PreparationRoadmapFeature />);
    await screen.findByRole("heading", { name: "웨딩홀 로드맵" });
    const cards = screen.getByRole("list", { name: "내 할 일이 있는 단계" });
    expect(
      within(cards).queryByRole("article", { name: "예식 형태 결정" }),
    ).toBeNull();
    expect(screen.getByText("내 웨딩홀 투어")).toBeTruthy();
    expect(screen.queryByText("웨딩홀 견적 비교")).toBeNull();
    expect(
      within(
        within(cards).getByRole("article", { name: "내가 추가한 일" }),
      ).getByText("우리만의 준비"),
    ).toBeTruthy();
    expect(screen.getByText("내 웨딩홀 투어")).toBeTruthy();
  });

  it("내 로드맵과 전체 단계 전환 시 카테고리 선택과 연결 영역을 유지한다", async () => {
    render(<PreparationRoadmapFeature />);
    await screen.findByRole("heading", { name: "웨딩홀 로드맵" });
    expect(
      screen
        .getByRole("button", { name: "스드메" })
        .getAttribute("aria-controls"),
    ).toBe("personal-roadmap-content");
    fireEvent.click(screen.getByRole("button", { name: "스드메" }));
    expect(screen.getByText("아직 담은 할 일이 없어요.")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "전체 단계에서 할 일 고르기" }),
    );
    await screen.findByRole("button", {
      name: "01 스드메 상담·견적과 패키지 계약",
    });
    expect(
      screen
        .getByRole("button", { name: "스드메" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "스드메" })
        .getAttribute("aria-controls"),
    ).toBe("preparation-roadmap-content");
    fireEvent.click(screen.getByRole("button", { name: "웨딩홀" }));
    await screen.findByRole("heading", { name: "웨딩홀 · 전체 단계" });
    fireEvent.click(screen.getByRole("button", { name: "내 로드맵" }));
    await screen.findByRole("heading", { name: "웨딩홀 로드맵" });
    const categories = screen.getByRole("navigation", {
      name: "준비 카테고리",
    });
    expect(within(categories).getByRole("list")).toBeTruthy();
    expect(
      within(categories)
        .getByRole("button", { name: "웨딩홀" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      within(categories)
        .getByRole("button", { name: "스드메" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("비로그인 내 로드맵은 카테고리를 유지하고 콘텐츠 영역에 로그인 안내를 표시한다", async () => {
    mocks.authState = { status: "guest" };
    render(<PreparationRoadmapFeature />);
    await screen.findByRole("button", { name: "01 웨딩홀 투어와 계약" });
    fireEvent.click(screen.getByRole("button", { name: "스드메" }));
    fireEvent.click(screen.getByRole("button", { name: "내 로드맵" }));
    const notice = screen.getByRole("region", { name: "내 로드맵" });
    expect(
      within(notice).getByText("로그인하면 내 로드맵을 확인할 수 있어요."),
    ).toBeTruthy();
    expect(
      within(notice).getByRole("link", { name: "로그인" }).getAttribute("href"),
    ).toBe("/login");
    expect(screen.getByRole("heading", { name: "스드메 로드맵" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "전체 단계 목록" })).toBeNull();
    const categories = screen.getByRole("navigation", {
      name: "준비 카테고리",
    });
    expect(
      within(categories)
        .getByRole("button", { name: "스드메" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(within(categories).getByRole("button", { name: "웨딩홀" }));
    expect(screen.getByRole("heading", { name: "웨딩홀 로드맵" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "내 로드맵" })).toBe(notice);
    fireEvent.click(
      within(notice).getByRole("button", { name: "전체 단계 보기" }),
    );
    expect(
      screen.getByRole("heading", { name: "웨딩홀 · 전체 단계" }),
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "전체 단계 목록" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "내 로드맵" })).toBeNull();
    expect(mocks.getChecklist).not.toHaveBeenCalled();
    expect(mocks.getCatalog).toHaveBeenCalledTimes(1);
  });

  it("PC에서도 전체 단계 상세를 펼치고 담은 일을 개인 목록에서 확인한다", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    render(<PreparationRoadmapFeature />);
    await screen.findByRole("heading", { name: "웨딩홀 로드맵" });
    showAll();
    const step = await screen.findByRole("button", {
      name: "01 웨딩홀 투어와 계약",
    });
    expect(
      screen.queryByRole("complementary", { name: "이 단계에서 준비할 일" }),
    ).toBeNull();
    fireEvent.click(step);
    const detail = screen.getByRole("complementary", {
      name: "이 단계에서 준비할 일",
    });
    fireEvent.click(
      within(detail).getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );
    await waitFor(() =>
      expect(mocks.addCatalogItemIds).toHaveBeenCalledWith(
        "authenticated",
        ["102"],
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() =>
      expect(
        within(detail).queryByRole("button", { name: "웨딩홀 견적 비교 추가" }),
      ).toBeNull(),
    );
    mocks.getChecklist.mockResolvedValue({
      categories: [
        {
          ...checklist.categories[0],
          steps: [
            {
              id: "step-1",
              order: 1,
              title: "웨딩홀 투어와 계약",
              items: [item(1, "내 웨딩홀 투어"), item(3, "웨딩홀 견적 비교")],
            },
          ],
        },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "내 로드맵" }));
    await screen.findByText("웨딩홀 견적 비교");
    vi.unstubAllGlobals();
  });

  it("조회 오류를 빈 상태와 구분하고 재시도한다", async () => {
    mocks.getChecklist.mockRejectedValueOnce(new Error("failed"));
    render(<PreparationRoadmapFeature />);
    await screen.findByRole("alert");
    expect(screen.queryByText("아직 담은 할 일이 없어요.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByText("내 웨딩홀 투어");
  });

  it("인증 만료를 안내하고 세션을 갱신한다", async () => {
    mocks.getChecklist.mockRejectedValueOnce(
      new ChecklistQueryAuthenticationRequiredError(),
    );
    render(<PreparationRoadmapFeature />);
    await screen.findByRole("alert");
    expect(mocks.refreshAuth).toHaveBeenCalled();
    expect(
      screen.getByText("로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요."),
    ).toBeTruthy();
  });

  it("사용자 변경 시 이전 개인 목록을 즉시 숨긴다", async () => {
    const { rerender } = render(<PreparationRoadmapFeature />);
    await screen.findByText("내 웨딩홀 투어");
    mocks.authState = {
      status: "authenticated",
      user: { id: 2, nickname: "다른 사용자" },
    };
    mocks.getChecklist.mockReturnValue(new Promise(() => {}));
    rerender(<PreparationRoadmapFeature />);
    expect(screen.queryByText("내 웨딩홀 투어")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("불러오고");
  });
});
