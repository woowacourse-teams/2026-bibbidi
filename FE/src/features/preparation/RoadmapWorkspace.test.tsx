import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function showAll() {
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "로드맵 보기" })).getByRole(
      "button",
      { name: "전체 단계" },
    ),
  );
}

describe("준비 로드맵 보기 전환", () => {
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

  it("빈 카테고리에서 전체 단계로 전환하며 카테고리를 유지한다", async () => {
    render(<PreparationRoadmapFeature />);
    await screen.findByRole("heading", { name: "웨딩홀 로드맵" });
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
  });

  it("비로그인은 전체 단계로 진입하고 내 로드맵에서는 로그인 안내를 본다", async () => {
    mocks.authState = { status: "guest" };
    render(<PreparationRoadmapFeature />);
    await screen.findByRole("button", { name: "01 웨딩홀 투어와 계약" });
    expect(mocks.getChecklist).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "내 로드맵" }));
    expect(
      screen.getByRole("link", { name: "로그인" }).getAttribute("href"),
    ).toBe("/login");
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
