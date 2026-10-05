import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../auth";
import { catalogRepository } from "../catalog";
import {
  ChecklistQueryModel,
  useChecklistQueryRepository,
  useMyChecklistQueryRepository,
  useMyChecklistCommandRepository,
} from "../checklist";
import { usePreparationChecklistRepository } from "../preparation";
import { preparationCatalogFixture } from "../preparation/test/fixtures/preparationCatalog.fixture";
import { HomeScheduleDashboardFeature } from "./HomeScheduleDashboardFeature";

vi.mock("../auth", () => ({ useAuth: vi.fn() }));
vi.mock("../catalog", () => ({ catalogRepository: { getCatalog: vi.fn() } }));
vi.mock("../checklist", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../checklist")>()),
  useChecklistQueryRepository: vi.fn(),
  useMyChecklistQueryRepository: vi.fn(),
  useMyChecklistCommandRepository: vi.fn(),
  useMyChecklistRevision: () => 0,
}));
vi.mock("../preparation", () => ({
  PreparationAuthenticationRequiredError: class extends Error {},
  usePreparationChecklistRepository: vi.fn(),
}));
vi.mock("../../infrastructure/analytics", () => ({
  analytics: { track: vi.fn() },
}));
const query = { getChecklist: vi.fn() };
const cache = { getChecklist: vi.fn(), invalidate: vi.fn() };
const command = { createAppointment: vi.fn() };
const addition = { getCatalogItemIds: vi.fn(), addCatalogItemIds: vi.fn() };
const recommended = { getRecommendedCatalogItems: vi.fn() };
const refreshAuth = vi.fn();
const user = { id: 1, nickname: "비비디" };
let checklist: {
  categories: (Omit<ChecklistQueryModel["categories"][number], "items"> & {
    items: ChecklistQueryModel["categories"][number]["items"];
  })[];
};
const recommendedItem = {
  catalogItemId: 101,
  title: "웨딩홀 투어",
  category: "웨딩홀",
  stepName: "웨딩홀 정하기",
  phase: 1,
};
function task(
  id: number,
  catalogId: number | null,
  appointments: import("../checklist").MyChecklistAppointmentModel[] = [],
  status: "prev" | "done" = "prev",
) {
  return {
    id: `checklist-item-${id}`,
    checklistItemId: id,
    sourceCatalogItemId: catalogId,
    title: `내 할 일 ${id}`,
    categoryId: "1",
    status,
    appointments,
  };
}
function setAuth(status: "guest" | "authenticated") {
  vi.mocked(useAuth).mockReturnValue({
    authState: status === "guest" ? { status } : { status, user },
    refreshAuth,
    beginAuthentication: vi.fn(),
    beginOnboarding: vi.fn(),
    completeAuthentication: vi.fn(),
    endAuthentication: vi.fn(),
    failAuthentication: vi.fn(),
    requireAccountSetup: vi.fn(),
  });
}
function mount(entry = "/calendar") {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[entry]}>
        <HomeScheduleDashboardFeature
          getReferenceDate={() => "2026-10-05"}
          recommendedRepository={recommended}
        />
      </MemoryRouter>
    </StrictMode>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  setAuth("authenticated");
  checklist = { categories: [{ id: "1", title: "웨딩홀", items: [] }] };
  query.getChecklist.mockImplementation(async () => checklist);
  cache.getChecklist.mockImplementation(async () => ({
    exists: true,
    items: [],
  }));
  command.createAppointment.mockResolvedValue(undefined);
  addition.getCatalogItemIds.mockResolvedValue([]);
  addition.addCatalogItemIds.mockResolvedValue(["101"]);
  recommended.getRecommendedCatalogItems.mockResolvedValue([recommendedItem]);
  vi.mocked(catalogRepository.getCatalog).mockResolvedValue(
    preparationCatalogFixture,
  );
  vi.mocked(useChecklistQueryRepository).mockReturnValue(query);
  vi.mocked(useMyChecklistQueryRepository).mockReturnValue(
    cache as unknown as ReturnType<typeof useMyChecklistQueryRepository>,
  );
  vi.mocked(useMyChecklistCommandRepository).mockReturnValue(
    command as unknown as ReturnType<typeof useMyChecklistCommandRepository>,
  );
  vi.mocked(usePreparationChecklistRepository).mockReturnValue(addition);
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});
describe("calendar planning", () => {
  it("이미 담은 항목, 완료한 항목, 일정이 있는 항목을 구분해 실제 개수를 표시한다", async () => {
    checklist.categories[0].items = [
      task(1, 101),
      task(2, 102, [], "done"),
      task(3, 103, [
        {
          id: 9,
          title: "상담",
          date: "2026-10-07",
          startTime: null,
          endTime: null,
          isDone: false,
          memo: null,
          place: null,
        },
      ]),
    ];
    mount();
    const undated = await screen.findByRole("region", {
      name: "날짜를 정할 일 1개",
    });
    expect(within(undated).getByText("내 할 일 1")).toBeTruthy();
    expect(within(undated).queryByText("내 할 일 2")).toBeNull();
    expect(screen.queryByRole("heading", { name: "웨딩홀 투어" })).toBeNull();
    expect(screen.queryByText("다가오는 일정")).toBeNull();
  });
  it("추가 성공 이후 추천에서 제거하고 날짜 없는 내 할 일과 후속 행동을 표시한다", async () => {
    addition.addCatalogItemIds.mockImplementation(async () => {
      checklist = {
        categories: [
          {
            id: "1",
            title: "웨딩홀",
            items: [{ ...task(1, 101), title: "웨딩홀 투어" }],
          },
        ],
      };
      return ["101"];
    });
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "내 할 일에 추가" }),
    );
    await screen.findByRole("region", { name: "날짜를 정할 일 1개" });
    expect(screen.queryByText("내 할 일에 추가했어요.")).toBeNull();
    await screen.findByRole("region", { name: "날짜를 정할 일 1개" });
    expect(
      screen.queryByRole("button", { name: "내 할 일에 추가" }),
    ).toBeNull();
    expect(screen.getAllByRole("button", { name: "일정 추가" })).toHaveLength(
      1,
    );
    expect(addition.addCatalogItemIds).toHaveBeenCalledTimes(1);
  });
  it("저장 중 중복 추가를 막고 실패하면 추천을 유지하며 재시도한다", async () => {
    let reject!: (error: Error) => void;
    addition.addCatalogItemIds.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "내 할 일에 추가" }),
    );
    const busy = screen.getByRole("button", { name: "추가 중..." });
    expect(busy.hasAttribute("disabled")).toBe(true);
    fireEvent.click(busy);
    expect(addition.addCatalogItemIds).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error("failed")));
    expect(
      await screen.findByRole("button", { name: "다시 시도" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "웨딩홀 투어" })).toBeTruthy();
  });
  it("빈 체크리스트에서 추천 담기를 안내하고 가짜 일정을 표시하지 않는다", async () => {
    mount();
    expect(
      await screen.findByText("아래 추천에서 필요한 준비를 담아보세요."),
    ).toBeTruthy();
    expect(screen.queryByText("다가오는 일정")).toBeNull();
  });
  it("비로그인은 개인 개수 없이 로그인 안내와 시작 추천을 표시한다", async () => {
    setAuth("guest");
    mount();
    await screen.findByRole("heading", { name: "웨딩홀 투어" });
    const undated = screen.getByRole("region", { name: "날짜를 정할 일 0개" });
    expect(
      within(undated).getByText(/로그인하면 담은 할 일에 날짜를 정하고/),
    ).toBeTruthy();
    expect(
      within(undated)
        .getByRole("link", { name: "로그인하고 일정 관리하기 ›" })
        .getAttribute("href"),
    ).toBe("/login?returnTo=%2Fcalendar");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(recommended.getRecommendedCatalogItems).not.toHaveBeenCalled();
    expect(screen.queryByText("다가오는 일정")).toBeNull();
    expect(screen.queryByText(/추천에서 담기/)).toBeNull();
    expect(screen.queryByText("웨딩홀 정하기")).toBeNull();
    expect(screen.queryByRole("region", { name: "10월 5일 일정" })).toBeNull();
  });
  it("비로그인도 담기 이후 일정 추가를 선택하면 항목을 보존한 인증 경로를 제공한다", async () => {
    setAuth("guest");
    addition.addCatalogItemIds.mockImplementation(async () => {
      checklist.categories[0].items = [
        {
          ...task(1, 101),
          id: "101",
          checklistItemId: null,
          title: "웨딩홀 투어",
        },
      ];
      return ["101"];
    });
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "내 할 일에 추가" }),
    );
    await screen.findByRole("region", { name: "날짜를 정할 일 1개" });
    expect(screen.queryByText("내 할 일에 추가했어요.")).toBeNull();
    const undated = await screen.findByRole("region", {
      name: "날짜를 정할 일 1개",
    });
    expect(
      within(undated).getByRole("heading", { name: "웨딩홀 투어" }),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(within(undated).getByRole("button", { name: "일정 추가" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "로그인" }).getAttribute("href"),
    ).toContain("dateFor%3D101");
  });
  it("로그인 복귀에서 선택한 항목의 기존 일정 폼을 연다", async () => {
    checklist.categories[0].items = [task(1, 101)];
    mount("/calendar?dateFor=101");
    expect(await screen.findByRole("textbox", { name: /제목/ })).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: /제목/ }) as HTMLInputElement).value,
    ).toBe("내 할 일 1");
  });
  it("기존 API로 날짜 저장 후 미정 목록에서 제거하고 저장한 날짜로 캘린더를 이동한다", async () => {
    checklist.categories[0].items = [task(1, 101)];
    command.createAppointment.mockImplementation(async (_id, input) => {
      checklist = {
        categories: [
          {
            id: "1",
            title: "웨딩홀",
            items: [task(1, 101, [{ ...input, id: 10, isDone: false }])],
          },
        ],
      };
    });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "일정 추가" }));
    await screen.findByRole("textbox", { name: /제목/ });
    fireEvent.change(
      screen.getByLabelText("날짜", { exact: false, selector: "input" }),
      {
        target: { value: "2026-11-12" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(command.createAppointment).toHaveBeenCalledTimes(1),
    );
    await screen.findByRole("region", { name: "날짜를 정할 일 0개" });
    await screen.findByRole("table", { name: "2026년 11월 달력" });
    const day = screen.getByRole("region", { name: "11월 12일 일정" });
    fireEvent.click(within(day).getByRole("button"));
    expect(
      within(screen.getByRole("dialog")).getByRole("link").getAttribute("href"),
    ).toBe("/checklist?taskId=checklist-item-1");
  });
  it("저장 성공 뒤 조회만 실패하면 저장을 반복하지 않고 조회만 재시도한다", async () => {
    checklist.categories[0].items = [task(1, 101)];
    cache.getChecklist.mockRejectedValueOnce(new Error("refresh"));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "일정 추가" }));
    await screen.findByRole("textbox", { name: /제목/ });
    fireEvent.change(
      screen.getByLabelText("날짜", { exact: false, selector: "input" }),
      {
        target: { value: "2026-10-07" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "목록 다시 불러오기" }),
    );
    await waitFor(() => expect(cache.getChecklist).toHaveBeenCalledTimes(2));
    expect(command.createAppointment).toHaveBeenCalledTimes(1);
  });
  it("조회 실패를 빈 상태와 구분하고 재시도를 제공한다", async () => {
    query.getChecklist.mockRejectedValue(new Error("load"));
    mount();
    await screen.findByText(/내 할 일과 일정을 불러오지 못했어요/);
    expect(screen.queryByText("날짜를 정할 할 일이 없어요.")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "다시 시도" }).length,
    ).toBeGreaterThan(0);
  });
});
