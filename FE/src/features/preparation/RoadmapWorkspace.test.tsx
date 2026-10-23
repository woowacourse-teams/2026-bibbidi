import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../shared/responsive";
import {
  fireEvent,
  act,
  render as renderView,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { AuthState } from "../auth/model/auth";
import { ChecklistQueryModel } from "../checklist/model/checklistQuery";
import { installMatchMedia } from "../../test/matchMedia";
import { MyChecklistProvider } from "../checklist";

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
  command: { changeItemStatus: vi.fn(), hasRemainingAppointments: vi.fn() },
  track: vi.fn(),
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
    useChecklistCommandRepository: () => mocks.command,
    useChecklistCacheRepository: () => repository,
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
  analytics: { track: mocks.track },
}));

import { PreparationRoadmapFeature } from "./PreparationRoadmapFeature";
import { preparationCatalogFixture } from "./test/fixtures/preparationCatalog.fixture";
import { ChecklistQueryAuthenticationRequiredError } from "../checklist/repository/checklistQueryRepository";
import { ChecklistFeature } from "../checklist/ChecklistFeature";
import { ChecklistItemChangeError } from "../checklist/repository/myChecklistCommandRepository";
import { MyChecklistAuthenticationRequiredError } from "../checklist/repository/myChecklistQueryRepository";

function CurrentUrl() {
  const location = useLocation();
  return (
    <div data-testid="current-url">
      {location.pathname}
      {location.search}
    </div>
  );
}

function render(ui: ReactElement) {
  return renderView(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter>
        <MyChecklistProvider sessionKey="roadmap-workspace-test">
          {children}
          <CurrentUrl />
        </MyChecklistProvider>
      </MemoryRouter>
    ),
  });
}

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
  mocks.command.changeItemStatus.mockResolvedValue(undefined);
  mocks.command.hasRemainingAppointments.mockResolvedValue(false);
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
      matches: query === MOBILE_LAYOUT_MEDIA_QUERY,
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
        expect(screen.getByText("아직 담은 할 일이 없어요.")).toBeTruthy();
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
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
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
      await screen.findByRole("button", {
        name: "웨딩홀을 정한 다음엔 뭘 준비할까?",
      }),
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
    const input = await within(chat).findByRole<HTMLTextAreaElement>("textbox");
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
      await screen.findByRole("button", {
        name: "웨딩홀을 정한 다음엔 뭘 준비할까?",
      }),
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
      await screen.findByRole("button", {
        name: "촬영 전에 준비할 일을 정리해줘",
      }),
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

  it("각 카드에 완료 상태와 일정을 표시하고 변경 뒤 갱신한다", async () => {
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
    expect(
      within(card).getByRole<HTMLInputElement>("checkbox", {
        name: "우리만의 준비 완료",
      }).checked,
    ).toBe(true);
    expect(
      within(card).getByRole("button", { name: /우리만의 준비/ }),
    ).toBeTruthy();
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

  it("비로그인 내 로드맵은 카테고리를 유지하고 로컬에 담긴 할 일만 조회 없이 보여준다", async () => {
    mocks.authState = { status: "guest" };
    render(<PreparationRoadmapFeature />);
    await screen.findByRole("button", { name: "01 웨딩홀 투어와 계약" });
    fireEvent.click(screen.getByRole("button", { name: "스드메" }));
    fireEvent.click(screen.getByRole("button", { name: "내 로드맵" }));
    expect(screen.getByText("아직 담은 할 일이 없어요.")).toBeTruthy();
    expect(screen.getByText("1개 단계 · 내 할 일 0개")).toBeTruthy();
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
    const cards = screen.getByRole("list", { name: "내 할 일이 있는 단계" });
    expect(within(cards).getAllByRole("article")).toHaveLength(1);
    expect(within(cards).getByText("웨딩홀 투어")).toBeTruthy();
    expect(within(cards).queryByText("웨딩홀 견적 비교")).toBeNull();
    expect(screen.getByText("3개 단계 · 내 할 일 1개")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(within(cards).queryByRole("button")).toBeNull();
    expect(within(cards).queryByText(/완료|일정 없음|예정/)).toBeNull();
    expect(
      screen.queryByText("로그인하면 내 로드맵을 확인할 수 있어요."),
    ).toBeNull();
    fireEvent.click(within(categories).getByRole("button", { name: "스드메" }));
    fireEvent.click(
      screen.getByRole("button", { name: "전체 단계에서 할 일 고르기" }),
    );
    expect(
      screen.getByRole("heading", { name: "스드메 · 전체 단계" }),
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "전체 단계 목록" })).toBeTruthy();
    expect(
      screen.queryByRole("list", { name: "내 할 일이 있는 단계" }),
    ).toBeNull();
    expect(mocks.getChecklist).not.toHaveBeenCalled();
    expect(mocks.getCatalog).toHaveBeenCalledTimes(1);
    expect(mocks.getCatalogItemIds).toHaveBeenCalledExactlyOnceWith(
      "guest",
      expect.any(AbortSignal),
    );
    expect(mocks.command.changeItemStatus).not.toHaveBeenCalled();
    expect(mocks.command.hasRemainingAppointments).not.toHaveBeenCalled();
  });

  it("비로그인이 전체 단계에서 추가한 일은 내 로드맵에 재조회 없이 바로 반영된다", async () => {
    mocks.authState = { status: "guest" };
    render(<PreparationRoadmapFeature />);
    fireEvent.click(
      await screen.findByRole("button", { name: "01 웨딩홀 투어와 계약" }),
    );
    const detail = screen.getByRole("complementary", {
      name: "이 단계에서 준비할 일",
    });
    fireEvent.click(
      within(detail).getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );
    await waitFor(() =>
      expect(
        within(detail).queryByRole("button", { name: "웨딩홀 견적 비교 추가" }),
      ).toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: "내 로드맵" }));
    const cards = screen.getByRole("list", { name: "내 할 일이 있는 단계" });
    expect(within(cards).getByText("웨딩홀 투어")).toBeTruthy();
    expect(within(cards).getByText("웨딩홀 견적 비교")).toBeTruthy();
    expect(screen.getByText("3개 단계 · 내 할 일 2개")).toBeTruthy();
    expect(mocks.addCatalogItemIds).toHaveBeenCalledExactlyOnceWith(
      "guest",
      ["102"],
      expect.any(AbortSignal),
    );
    showAll();
    expect(screen.getByText("3개 단계 · 내 할 일 2개")).toBeTruthy();
    expect(mocks.getCatalog).toHaveBeenCalledOnce();
    expect(mocks.getCatalogItemIds).toHaveBeenCalledOnce();
    expect(mocks.getChecklist).not.toHaveBeenCalled();
    expect(mocks.command.changeItemStatus).not.toHaveBeenCalled();
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
    expect(screen.getByText("로드맵을 불러오고 있어요.")).toBeTruthy();
  });
});

describe("내 로드맵 할 일 동작", () => {
  it.each([
    ["prev", "done", "완료"],
    ["continue", "done", "완료"],
    ["done", "continue", "진행 중"],
  ] as const)(
    "%s 항목의 체크박스를 누르면 %s로 저장하고 현황을 갱신한다",
    async (before, after, label) => {
      let current = structuredClone(checklist);
      current.categories[0].steps![0].items[0].status = before;
      mocks.getChecklist.mockImplementation(async () => current);
      mocks.command.changeItemStatus.mockImplementation(async () => {
        current = structuredClone(current);
        current.categories[0].steps![0].items[0].status = after;
        mocks.revision += 1;
      });
      render(<PreparationRoadmapFeature />);
      fireEvent.click(
        await screen.findByRole("checkbox", { name: "내 웨딩홀 투어 완료" }),
      );
      await waitFor(() =>
        expect(mocks.command.changeItemStatus).toHaveBeenCalledWith(
          1,
          after,
          expect.any(AbortSignal),
        ),
      );
      const row = await screen.findByRole("button", {
        name: new RegExp(`내 웨딩홀 투어 ${label}`),
      });
      expect(within(row).getByText(`${label} · 일정 없음`)).toBeTruthy();
      const card = screen.getByRole("article", { name: "웨딩홀 투어와 계약" });
      expect(
        within(card).getByText(
          `내 할 일 1개 · 완료 ${after === "done" ? 1 : 0}개`,
        ),
      ).toBeTruthy();
      expect(screen.getByTestId("current-url").textContent).toBe("/");
      expect(mocks.command.hasRemainingAppointments).toHaveBeenCalledTimes(
        after === "done" ? 1 : 0,
      );
      expect(mocks.track).toHaveBeenCalledTimes(after === "done" ? 1 : 0);
    },
  );

  it("완료 확인 취소는 저장하지 않고, 동의하면 남은 일정과 함께 완료한다", async () => {
    mocks.command.hasRemainingAppointments.mockResolvedValue(true);
    render(<PreparationRoadmapFeature />);
    const checkbox = await screen.findByRole<HTMLInputElement>("checkbox", {
      name: "내 웨딩홀 투어 완료",
    });
    fireEvent.click(checkbox);
    let dialog = await screen.findByRole("dialog", {
      name: "남은 일정도 완료할까요?",
    });
    expect(checkbox.checked).toBe(false);
    expect(mocks.command.changeItemStatus).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.track).not.toHaveBeenCalled();
    fireEvent.click(checkbox);
    dialog = await screen.findByRole("dialog", {
      name: "남은 일정도 완료할까요?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "함께 완료" }));
    await waitFor(() =>
      expect(mocks.command.changeItemStatus).toHaveBeenCalledWith(
        1,
        "done",
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.track).toHaveBeenCalledOnce();
    expect(mocks.track).toHaveBeenCalledWith({
      name: "checklist_task_complete",
      parameters: { action: "complete", category_id: "wedding-hall" },
    });
    expect(screen.getByTestId("current-url").textContent).toBe("/");
  });

  it("저장 중 중복 조작을 막고 저장 실패 시 체크 상태를 유지하며 재시도한다", async () => {
    let reject: (error: unknown) => void = () => undefined;
    mocks.command.changeItemStatus.mockImplementationOnce(
      () =>
        new Promise((_resolve, rejectRequest) => {
          reject = rejectRequest;
        }),
    );
    render(<PreparationRoadmapFeature />);
    const checkbox = await screen.findByRole<HTMLInputElement>("checkbox", {
      name: "우리만의 준비 완료",
    });
    fireEvent.click(checkbox);
    await waitFor(() =>
      expect(mocks.command.changeItemStatus).toHaveBeenCalledOnce(),
    );
    expect(checkbox.disabled).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: /우리만의 준비 예정/,
      }).disabled,
    ).toBe(true);
    await act(async () => reject(new ChecklistItemChangeError("unknown")));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(false);
    fireEvent.click(checkbox);
    await waitFor(() =>
      expect(mocks.command.changeItemStatus).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("인증 만료 시 저장 실패를 알리고 세션을 갱신한다", async () => {
    mocks.command.changeItemStatus.mockRejectedValueOnce(
      new MyChecklistAuthenticationRequiredError(),
    );
    render(<PreparationRoadmapFeature />);
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "우리만의 준비 완료" }),
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mocks.refreshAuth).toHaveBeenCalledOnce();
  });

  it("저장 후 조회 실패는 오래된 카드를 숨기고 재조회로 복구한다", async () => {
    mocks.command.changeItemStatus.mockRejectedValueOnce(
      new ChecklistItemChangeError(
        "refresh-failed",
        "상태는 변경됐지만 최신 체크리스트를 불러오지 못했습니다. 다시 조회해주세요.",
      ),
    );
    render(<PreparationRoadmapFeature />);
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "우리만의 준비 완료" }),
    );
    await screen.findByText(
      "상태는 변경됐지만 최신 체크리스트를 불러오지 못했습니다. 다시 조회해주세요.",
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByRole("checkbox", { name: "우리만의 준비 완료" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.command.changeItemStatus).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    "모바일=%s에서 상세를 열고 닫으면 보던 로드맵 카테고리로 돌아온다",
    async (mobile) => {
      installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
      const current = structuredClone(checklist);
      current.categories[1].customItems = [
        { ...item(3, "스드메 상담", true), categoryId: "studio-dress-makeup" },
      ];
      mocks.getChecklist.mockResolvedValue(current);
      renderView(
        <MemoryRouter initialEntries={["/preparation"]}>
          <MyChecklistProvider sessionKey="roadmap-detail-test">
            <Routes>
              <Route
                path="/preparation"
                element={<PreparationRoadmapFeature />}
              />
              <Route path="/checklist" element={<ChecklistFeature />} />
            </Routes>
            <CurrentUrl />
          </MyChecklistProvider>
        </MemoryRouter>,
      );
      fireEvent.click(await screen.findByRole("button", { name: "스드메" }));
      fireEvent.click(
        await screen.findByRole("button", { name: /스드메 상담 예정/ }),
      );
      const detail = await screen.findByRole(
        mobile ? "dialog" : "complementary",
        { name: "스드메 상담" },
      );
      expect(screen.getByTestId("current-url").textContent).toBe(
        "/checklist?taskId=checklist-item-3",
      );
      expect(mocks.command.changeItemStatus).not.toHaveBeenCalled();
      if (mobile) {
        fireEvent.click(
          document.querySelector(
            ".checklist-detail-bottom-sheet__scrim",
          ) as HTMLButtonElement,
        );
        fireEvent.transitionEnd(detail, { propertyName: "transform" });
      } else {
        fireEvent.click(
          within(detail).getByRole("button", { name: "할 일 상세 닫기" }),
        );
      }
      await screen.findByRole("button", { name: /스드메 상담 예정/ });
      expect(screen.getByTestId("current-url").textContent).toBe(
        "/preparation?categoryId=studio-dress-makeup",
      );
      expect(
        screen
          .getByRole("button", { name: "스드메" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
    },
  );
});

describe("내 로드맵 갱신 중 목록 유지", () => {
  it("완료 저장 중과 갱신 후에도 카드·행 목록의 스크롤 위치를 유지한다", async () => {
    const updated = structuredClone(checklist);
    updated.categories[0].steps![0].items[0].status = "done";
    let resolveRefresh: (value: ChecklistQueryModel) => void = () => undefined;
    mocks.getChecklist.mockResolvedValueOnce(checklist).mockImplementationOnce(
      () =>
        new Promise<ChecklistQueryModel>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    mocks.command.changeItemStatus.mockImplementationOnce(async () => {
      mocks.revision += 1;
    });
    render(<PreparationRoadmapFeature />);
    const checkbox = await screen.findByRole<HTMLInputElement>("checkbox", {
      name: "내 웨딩홀 투어 완료",
    });
    const cards = screen.getByRole("list", { name: "내 할 일이 있는 단계" });
    const tasks = screen.getByRole("list", {
      name: "웨딩홀 투어와 계약의 할 일",
    });
    cards.scrollLeft = 240;
    tasks.scrollTop = 80;
    fireEvent.click(checkbox);
    await waitFor(() => expect(mocks.getChecklist).toHaveBeenCalledTimes(2));
    expect(cards.isConnected).toBe(true);
    expect(tasks.isConnected).toBe(true);
    expect(checkbox.disabled).toBe(true);
    await act(async () => resolveRefresh(updated));
    await screen.findByRole("button", { name: /내 웨딩홀 투어 완료/ });
    expect(screen.getByRole("list", { name: "내 할 일이 있는 단계" })).toBe(
      cards,
    );
    expect(
      screen.getByRole("list", { name: "웨딩홀 투어와 계약의 할 일" }),
    ).toBe(tasks);
    expect(cards.scrollLeft).toBe(240);
    expect(tasks.scrollTop).toBe(80);
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(false);
  });

  it("백그라운드 조회 실패 시 기존 카드를 숨기고 재시도로 복구한다", async () => {
    let rejectRefresh: (error: unknown) => void = () => undefined;
    mocks.getChecklist
      .mockResolvedValueOnce(checklist)
      .mockImplementationOnce(
        () =>
          new Promise<ChecklistQueryModel>((_resolve, reject) => {
            rejectRefresh = reject;
          }),
      )
      .mockResolvedValue(checklist);
    const { rerender } = render(<PreparationRoadmapFeature />);
    await screen.findByRole("checkbox", { name: "내 웨딩홀 투어 완료" });
    mocks.revision += 1;
    rerender(<PreparationRoadmapFeature />);
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", {
        name: "내 웨딩홀 투어 완료",
      }).disabled,
    ).toBe(true);
    await act(async () => rejectRefresh(new Error("조회 실패")));
    await screen.findByRole("alert");
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByRole("checkbox", { name: "내 웨딩홀 투어 완료" });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
