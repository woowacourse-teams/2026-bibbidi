import {
  fireEvent,
  act,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthState } from "../auth/model/auth";
import { ChecklistQueryModel } from "../checklist/model/checklistQuery";
import { installMatchMedia } from "../../test/matchMedia";

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
  stream: vi.fn(),
}));
vi.mock("../ai-chat/api/streamAiChat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ai-chat/api/streamAiChat")>()),
  streamAiChat: mocks.stream,
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
  mocks.stream.mockReset();
  mocks.stream.mockImplementation(async (_request, receiver) => {
    receiver.onConversation("d67a9265-3f45-4d7f-99f1-b5823054c8d9");
    receiver.onDelta("실제 준비 안내");
  });
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

function showAll() {
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "로드맵 보기" })).getByRole(
      "button",
      { name: "전체 단계" },
    ),
  );
}

function mockMobile() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(max-width: 760px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("준비 로드맵 보기 전환", () => {
  it.each(["authenticated", "guest"])(
    "모바일 %s 사용자는 보기 선택 시트에서 카테고리를 유지하며 로드맵을 전환한다",
    async (audience) => {
      mockMobile();
      if (audience === "guest") mocks.authState = { status: "guest" };
      render(<PreparationRoadmapFeature />);
      await screen.findByRole("button", { name: "스드메" });
      fireEvent.click(screen.getByRole("button", { name: "스드메" }));
      const initialView = audience === "guest" ? "전체 단계" : "내 로드맵";
      const trigger = await screen.findByRole("button", { name: initialView });
      trigger.focus();
      fireEvent.click(trigger);
      const dialog = screen.getByRole("dialog", { name: "보기 선택" });
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(document.body.style.overflow).toBe("hidden");
      expect(
        within(dialog)
          .getByRole("button", { name: new RegExp(initialView) })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      const nextView = audience === "guest" ? "내 로드맵" : "전체 단계";
      fireEvent.click(
        within(dialog).getByRole("button", { name: new RegExp(nextView) }),
      );
      expect(screen.queryByRole("dialog", { name: "보기 선택" })).toBeNull();
      expect(document.body.style.overflow).toBe("");
      const nextTrigger = await screen.findByRole("button", { name: nextView });
      await waitFor(() => expect(document.activeElement).toBe(nextTrigger));
      expect(
        screen
          .getByRole("button", { name: "스드메" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        screen.queryByRole("navigation", { name: "로드맵 보기" }),
      ).toBeNull();
      if (audience === "guest")
        expect(
          screen.getByText("로그인하면 내 로드맵을 확인할 수 있어요."),
        ).toBeTruthy();
      else
        expect(
          screen.getByRole("region", { name: "전체 단계 목록" }),
        ).toBeTruthy();
    },
  );

  it.each([
    "닫기 버튼",
    "바깥 영역",
    "Escape",
    "아래로 밀기",
    "현재 보기 선택",
  ])(
    "모바일 보기 선택 시트는 %s로 닫고 선택과 포커스를 유지한다",
    async (method) => {
      mockMobile();
      render(<PreparationRoadmapFeature />);
      await screen.findByText("내 웨딩홀 투어");
      const trigger = screen.getByRole("button", { name: "내 로드맵" });
      trigger.focus();
      fireEvent.click(trigger);
      const dialog = screen.getByRole("dialog", { name: "보기 선택" });
      const handle = within(dialog).getByRole("button", {
        name: "아래로 밀어 보기 선택 닫기",
      });
      expect(document.activeElement).toBe(handle);
      const lastOption = within(dialog).getByRole("button", {
        name: /전체 단계/,
      });
      lastOption.focus();
      fireEvent.keyDown(lastOption, { key: "Tab" });
      expect(document.activeElement).toBe(handle);
      if (method === "닫기 버튼")
        fireEvent.click(
          within(dialog).getByRole("button", { name: "보기 선택 닫기" }),
        );
      else if (method === "바깥 영역")
        fireEvent.click(
          screen
            .getAllByRole("button", { name: "보기 선택 닫기" })
            .find((button) => !dialog.contains(button))!,
        );
      else if (method === "Escape")
        fireEvent.keyDown(handle, { key: "Escape" });
      else if (method === "현재 보기 선택")
        fireEvent.click(
          within(dialog).getByRole("button", { name: /내 로드맵/ }),
        );
      else {
        fireEvent.pointerDown(handle, {
          button: 0,
          clientY: 20,
          pointerId: 1,
          pointerType: "touch",
        });
        fireEvent.pointerMove(handle, {
          clientY: 140,
          pointerId: 1,
          pointerType: "touch",
        });
        fireEvent.pointerUp(handle, {
          clientY: 140,
          pointerId: 1,
          pointerType: "touch",
        });
      }
      fireEvent.transitionEnd(dialog, { propertyName: "transform" });
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "보기 선택" })).toBeNull(),
      );
      expect(document.activeElement).toBe(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(document.body.style.overflow).toBe("");
    },
  );

  it("PC로 전환하면 열린 선택 시트를 닫고 모바일로 돌아와도 다시 열지 않는다", async () => {
    const media = installMatchMedia("(max-width: 760px)", true);
    render(<PreparationRoadmapFeature />);
    await screen.findByText("내 웨딩홀 투어");
    fireEvent.click(screen.getByRole("button", { name: "내 로드맵" }));
    expect(screen.getByRole("dialog", { name: "보기 선택" })).toBeTruthy();
    act(() => media.setMatches(false));
    expect(screen.queryByRole("dialog", { name: "보기 선택" })).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "로드맵 보기" }),
    ).toBeTruthy();
    expect(document.body.style.overflow).toBe("");
    act(() => media.setMatches(true));
    expect(screen.queryByRole("dialog", { name: "보기 선택" })).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "내 로드맵" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("로그인 사용자는 실제 채팅을 사용하고 카테고리·로드맵 전환 중 대화를 유지한다", async () => {
    render(<PreparationRoadmapFeature />);
    await screen.findByText("내 웨딩홀 투어");
    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀을 정한 다음엔 뭘 준비할까?" }),
    );
    await screen.findByText("실제 준비 안내");
    fireEvent.click(screen.getByRole("button", { name: "스드메" }));
    expect(screen.getByRole("log").textContent).toContain("실제 준비 안내");
    showAll();
    await screen.findByRole("button", {
      name: "01 스드메 상담·견적과 패키지 계약",
    });
    expect(screen.getByRole("log").textContent).toContain("실제 준비 안내");
    expect(mocks.addCatalogItemIds).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "예시로 담은 일" })).toBeNull();
  });

  it("비로그인은 채팅에서 로그인 안내를 보고 카테고리 전환으로 API를 호출하지 않는다", async () => {
    mocks.authState = { status: "guest" };
    render(<PreparationRoadmapFeature />);
    await screen.findByRole("button", { name: "01 웨딩홀 투어와 계약" });
    const chat = screen.getByRole("complementary", { name: "AI 채팅" });
    const input = within(chat).getByRole<HTMLTextAreaElement>("textbox");
    expect(input.placeholder).toBe("로그인 후 AI와 대화할 수 있어요");
    expect(input.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "스드메" }));
    fireEvent.click(screen.getByRole("button", { name: "내 로드맵" }));
    expect(input.placeholder).toBe("로그인 후 AI와 대화할 수 있어요");
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("사용자 변경 시 대화와 진행 요청을 초기화하고 이전 사용자의 늦은 조각을 무시한다", async () => {
    mocks.stream.mockImplementationOnce((_request, receiver) => {
      receiver.onConversation("d67a9265-3f45-4d7f-99f1-b5823054c8d9");
      receiver.onDelta("이전 사용자 답변");
      return new Promise(() => {});
    });
    const { rerender } = render(<PreparationRoadmapFeature />);
    await screen.findByText("내 웨딩홀 투어");
    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀을 정한 다음엔 뭘 준비할까?" }),
    );
    const previousReceiver = mocks.stream.mock.calls[0][1];
    const previousSignal = mocks.stream.mock.calls[0][2] as AbortSignal;
    expect(screen.getByText("이전 사용자 답변")).toBeTruthy();
    mocks.authState = {
      status: "authenticated",
      user: { id: 2, nickname: "다른 사용자" },
    };
    rerender(<PreparationRoadmapFeature />);
    expect(previousSignal.aborted).toBe(true);
    expect(screen.queryByRole("log")).toBeNull();
    act(() => previousReceiver.onDelta("늦은 답변"));
    expect(screen.queryByText("늦은 답변")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "촬영 전에 준비할 일을 정리해줘" }),
    );
    await screen.findByText("실제 준비 안내");
    expect(mocks.stream.mock.calls[1][0].conversationId).toBeUndefined();
    expect(screen.queryByText("이전 사용자 답변")).toBeNull();
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
