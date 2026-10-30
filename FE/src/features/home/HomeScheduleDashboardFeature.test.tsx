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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../auth";
import { analytics } from "../../infrastructure/analytics";
import { catalogRepository } from "../catalog";
import {
  ChecklistQueryModel,
  ChecklistQueryAuthenticationRequiredError,
  ChecklistQueryRequestAbortedError,
  useChecklistQueryRepository,
  useMyChecklistQueryRepository,
  useMyChecklistCommandRepository,
} from "../checklist";
import {
  PreparationAuthenticationRequiredError,
  usePreparationChecklistRepository,
} from "../preparation";
import { preparationCatalogFixture } from "../preparation/test/fixtures/preparationCatalog.fixture";
import { dateLabel, localToday } from "../../shared/date/calendarDate";
import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../shared/responsive";
import { installMatchMedia } from "../../test/matchMedia";
import { HomeScheduleDashboardFeature } from "./HomeScheduleDashboardFeature";
import {
  RecommendedCatalogItemsAuthenticationRequiredError,
  RecommendedCatalogItemsRequestAbortedError,
  RecommendedCatalogItemsRepository,
} from "./repository/recommendedCatalogItemsRepository";

vi.mock("../auth", () => ({ useAuth: vi.fn() }));
vi.mock("../catalog", () => ({ catalogRepository: { getCatalog: vi.fn() } }));
vi.mock("../checklist", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../checklist")>()),
  useChecklistQueryRepository: vi.fn(),
  useMyChecklistQueryRepository: vi.fn(),
  useMyChecklistCommandRepository: vi.fn(),
  useMyChecklistRevision: () => 0,
}));
vi.mock("../preparation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../preparation")>()),
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
function setAuth(status: "guest" | "authenticated" | "synchronizing", id = 1) {
  vi.mocked(useAuth).mockReturnValue({
    authState:
      status === "guest" ? { status } : { status, user: { ...user, id } },
    refreshAuth,
    beginAuthentication: vi.fn(),
    beginOnboarding: vi.fn(),
    completeAuthentication: vi.fn(),
    endAuthentication: vi.fn(),
    failAuthentication: vi.fn(),
  });
}
function mount(entry = "/calendar") {
  const ui = (repository: RecommendedCatalogItemsRepository) => (
    <StrictMode>
      <MemoryRouter initialEntries={[entry]}>
        <div
          data-modal-scope
          data-page-scroll-container
          style={{ overflow: "auto" }}
        >
          <HomeScheduleDashboardFeature
            getReferenceDate={() => "2026-10-05"}
            recommendedRepository={repository}
          />
        </div>
      </MemoryRouter>
    </StrictMode>
  );
  const result = render(ui(recommended));
  return {
    ...result,
    rerenderFeature(repository = recommended) {
      result.rerender(ui(repository));
    },
  };
}
async function chooseDate(date: string) {
  const trigger = screen.getByRole("button", { name: /^날짜 / });
  fireEvent.click(trigger);
  const picker = screen.getByRole("dialog", { name: "날짜 선택" });
  const [year, month] = date.split("-").map(Number);
  const [currentYear, currentMonth] = localToday().split("-").map(Number);
  const difference = (year - currentYear) * 12 + month - currentMonth;
  for (let index = 0; index < Math.abs(difference); index++)
    fireEvent.click(
      within(picker).getByRole("button", {
        name: difference > 0 ? "다음 달" : "이전 달",
      }),
    );
  fireEvent.click(
    within(picker).getByRole("gridcell", { name: dateLabel(date) }),
  );
  fireEvent.click(within(picker).getByRole("button", { name: "확인" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "날짜 선택" })).toBeNull(),
  );
}

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.resetAllMocks();
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
  it("이미 담은 항목, 완료한 항목, 일정이 있는 항목을 구분해 날짜 미정 항목을 표시한다", async () => {
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
    const undated = screen.getByRole("region", {
      name: "날짜를 정할 일",
    });
    expect(await within(undated).findByText("내 할 일 1")).toBeTruthy();
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

    expect(screen.queryByText("내 할 일에 추가했어요.")).toBeNull();
    await within(
      screen.getByRole("region", { name: "날짜를 정할 일" }),
    ).findByRole("heading", { name: "웨딩홀 투어" });
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
    const addButton = await screen.findByRole("button", {
      name: "내 할 일에 추가",
    });
    addButton.focus();
    fireEvent.click(addButton);
    const busy = screen.getByRole("button", { name: "추가 중..." });
    expect(busy.hasAttribute("disabled")).toBe(false);
    expect(busy.getAttribute("aria-disabled")).toBe("true");
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(document.activeElement).toBe(busy);
    fireEvent.click(busy);
    expect(addition.addCatalogItemIds).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error("failed")));
    expect(
      await screen.findByRole("button", { name: "다시 시도" }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(busy);
    expect(screen.getByRole("heading", { name: "웨딩홀 투어" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(analytics.track).toHaveBeenCalledTimes(1));
    expect(addition.addCatalogItemIds).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
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
    const undated = screen.getByRole("region", { name: "날짜를 정할 일" });
    expect(
      within(undated).getByText(/로그인하면 담은 할 일에 날짜를 정하고/),
    ).toBeTruthy();
    expect(
      within(undated)
        .getByRole("link", { name: "로그인하고 일정 관리하기" })
        .getAttribute("href"),
    ).toBe("/calendar");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(recommended.getRecommendedCatalogItems).not.toHaveBeenCalled();
    expect(screen.queryByText("다가오는 일정")).toBeNull();
    expect(screen.queryByText(/추천에서 담기/)).toBeNull();
    expect(screen.queryByText("웨딩홀 정하기")).toBeNull();
    expect(
      within(
        screen.getByRole("region", { name: "2026년 10월 5일 일정" }),
      ).getByText("이 날짜에 등록된 일정이 없어요."),
    ).toBeTruthy();
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
    await within(
      screen.getByRole("region", { name: "날짜를 정할 일" }),
    ).findByRole("heading", { name: "웨딩홀 투어" });
    expect(screen.queryByText("내 할 일에 추가했어요.")).toBeNull();
    const undated = await screen.findByRole("region", {
      name: "날짜를 정할 일",
    });
    expect(
      within(undated).getByRole("heading", { name: "웨딩홀 투어" }),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(within(undated).getByRole("button", { name: "일정 추가" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(screen.queryByRole("dialog")).toBeNull();
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
    await chooseDate("2026-11-12");
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(command.createAppointment).toHaveBeenCalledTimes(1),
    );
    await within(
      screen.getByRole("region", { name: "날짜를 정할 일" }),
    ).findByText("날짜를 정할 할 일이 없어요.");
    await screen.findByRole("table", { name: "2026년 11월 달력" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(
      screen
        .getByRole("heading", { name: "내 준비 일정", level: 1 })
        .closest("header"),
    );
    const day = screen.getByRole("region", { name: "2026년 11월 12일 일정" });
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
    await chooseDate("2026-10-07");
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
    await screen.findByText("일정을 확인하지 못했어요.");
    expect(screen.queryByText("날짜를 정할 할 일이 없어요.")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "다시 시도" }).length,
    ).toBeGreaterThan(0);
  });
});

// 기존 화면의 회귀 계약을 현재 체크리스트 조회·일정 모달 구조로 옮긴다.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function checklistWithSchedule(title: string): ChecklistQueryModel {
  return {
    categories: [
      {
        id: "1",
        title: "웨딩홀",
        items: [
          task(1, 100, [
            {
              id: 91,
              title,
              date: "2026-10-07",
              startTime: null,
              endTime: null,
              isDone: false,
              memo: null,
              place: null,
            },
          ]),
        ],
      },
    ],
  };
}

function currentQuerySignal() {
  return query.getChecklist.mock.calls.at(-1)![1] as AbortSignal;
}
function currentRecommendationSignal() {
  return recommended.getRecommendedCatalogItems.mock.calls.at(
    -1,
  )![0] as AbortSignal;
}
function recommendationRegion() {
  return screen.getByRole("region", { name: "추천 할 일" });
}
function dateCell() {
  return screen.getByLabelText("2026년 10월 7일").closest("td")!;
}

// 추천 API 경로를 검증할 때는 시작 항목 추천으로 분기되지 않도록 내 할 일을 둔다.
describe("캘린더의 기존 조회·인증·비동기 회귀 계약", () => {
  beforeEach(() => {
    checklist.categories[0].items = [task(1, 100)];
  });

  it("로그인 사용자의 실제 체크리스트 일정을 해당 날짜에 표시한다", async () => {
    query.getChecklist.mockResolvedValue(checklistWithSchedule("웨딩홀 상담"));
    mount();
    expect(
      await within(dateCell()).findByRole("button", { name: /웨딩홀 상담/ }),
    ).toBeTruthy();
    expect(query.getChecklist).toHaveBeenCalledWith(
      "authenticated",
      expect.any(AbortSignal),
    );
  });

  it("날짜 없는 목록은 조회 순서대로 3개를 표시하고 푸터로 나머지를 펼치고 접는다", async () => {
    checklist.categories[0].items = [
      task(4, 104),
      task(3, 103),
      task(2, 102),
      task(1, 100),
    ];
    mount();
    const region = screen.getByRole("region", {
      name: "날짜를 정할 일",
    });
    await within(region).findByRole("heading", { name: "내 할 일 4" });
    expect(
      within(region)
        .getAllByRole("heading", { level: 3 })
        .map((node) => node.textContent),
    ).toEqual(["내 할 일 4", "내 할 일 3", "내 할 일 2"]);
    expect(within(region).queryByText("내 할 일 1")).toBeNull();
    expect(
      within(region)
        .getByRole("link", { name: "내 할 일 전체 보기" })
        .getAttribute("href"),
    ).toBe("/checklist");

    const more = within(region).getByRole("button", {
      name: "날짜를 정할 일 나머지 1개 더 보기",
    });
    const list = document.getElementById(more.getAttribute("aria-controls")!);
    expect(list?.tagName).toBe("UL");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    const queryCount = query.getChecklist.mock.calls.length;
    more.focus();
    fireEvent.click(more);
    expect(
      within(region)
        .getAllByRole("heading", { level: 3 })
        .map((node) => node.textContent),
    ).toEqual(["내 할 일 4", "내 할 일 3", "내 할 일 2", "내 할 일 1"]);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(more);
    fireEvent.click(
      within(region).getByRole("button", { name: "날짜를 정할 일 접기" }),
    );
    expect(within(region).queryByText("내 할 일 1")).toBeNull();
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(more);
    expect(query.getChecklist).toHaveBeenCalledTimes(queryCount);
  });

  it("조회 중에는 빈 상태를 표시하지 않고 응답 이후 실제 목록으로 전환한다", async () => {
    const request = deferred<ChecklistQueryModel>();
    query.getChecklist.mockReturnValue(request.promise);
    mount();
    expect(
      screen.getByRole("status", { name: "내 할 일을 불러오는 중" }),
    ).toBeTruthy();
    expect(screen.queryByText("날짜를 정할 할 일이 없어요.")).toBeNull();
    await act(async () => undefined);
    expect(
      screen.getByRole("status", { name: "추천 할 일을 불러오는 중" }),
    ).toBeTruthy();
    expect(screen.queryByText("지금 추가할 추천 항목이 없어요.")).toBeNull();
    await act(async () => request.resolve(checklist));
    await within(
      screen.getByRole("region", { name: "날짜를 정할 일" }),
    ).findByRole("heading", { name: "내 할 일 1" });
    expect(
      screen.queryByRole("status", { name: "내 할 일을 불러오는 중" }),
    ).toBeNull();
  });

  it("완료 항목만 있으면 날짜 없는 목록을 빈 상태로 표시한다", async () => {
    checklist.categories[0].items = [task(1, 100, [], "done")];
    mount();
    await screen.findByText("날짜를 정할 할 일이 없어요.");
    expect(
      screen.queryByText("아래 추천에서 필요한 준비를 담아보세요."),
    ).toBeNull();
    expect(screen.getByRole("region", { name: "날짜를 정할 일" })).toBeTruthy();
  });

  it("추천 조회 중 상태를 표시하고 API 순서를 유지한 목록으로 전환한다", async () => {
    const request = deferred<(typeof recommendedItem)[]>();
    recommended.getRecommendedCatalogItems.mockReturnValue(request.promise);
    mount();
    expect(
      screen.getByRole("status", { name: "추천 할 일을 불러오는 중" }),
    ).toBeTruthy();
    await act(async () =>
      request.resolve([
        { ...recommendedItem, catalogItemId: 203, title: "먼저 받은 추천" },
        { ...recommendedItem, catalogItemId: 202, title: "다음 추천" },
      ]),
    );
    expect(
      within(recommendationRegion())
        .getAllByRole("heading", { level: 3 })
        .map((node) => node.textContent),
    ).toEqual(["먼저 받은 추천", "다음 추천"]);
    expect(
      screen.queryByRole("status", { name: "추천 할 일을 불러오는 중" }),
    ).toBeNull();
  });

  it("추천 빈 응답을 오류와 구분하고 로드맵 이동을 제공한다", async () => {
    recommended.getRecommendedCatalogItems.mockResolvedValue([]);
    mount();
    await screen.findByText("지금 추가할 추천 항목이 없어요.");
    expect(within(recommendationRegion()).queryByRole("alert")).toBeNull();
    expect(
      within(recommendationRegion())
        .getByRole("link", { name: /로드맵 전체 보기/ })
        .getAttribute("href"),
    ).toBe("/preparation");
  });

  it("추천 오류만 재시도하고 내 할 일과 캘린더 결과는 유지한다", async () => {
    query.getChecklist.mockResolvedValue(checklistWithSchedule("유지할 일정"));
    recommended.getRecommendedCatalogItems
      .mockRejectedValueOnce(new Error("서버 내부 메시지"))
      .mockRejectedValueOnce(new Error("서버 내부 메시지"))
      .mockResolvedValue([]);
    mount();
    await within(dateCell()).findByRole("button", { name: /유지할 일정/ });
    await within(recommendationRegion()).findByRole("alert");
    expect(screen.queryByText("서버 내부 메시지")).toBeNull();
    const queryCount = query.getChecklist.mock.calls.length;
    const recommendationCount =
      recommended.getRecommendedCatalogItems.mock.calls.length;
    fireEvent.click(
      within(recommendationRegion()).getByRole("button", { name: "다시 시도" }),
    );
    await within(recommendationRegion()).findByText(
      "지금 추가할 추천 항목이 없어요.",
    );
    expect(query.getChecklist).toHaveBeenCalledTimes(queryCount);
    expect(recommended.getRecommendedCatalogItems).toHaveBeenCalledTimes(
      recommendationCount + 1,
    );
    expect(
      within(dateCell()).getByRole("button", { name: /유지할 일정/ }),
    ).toBeTruthy();
  });

  it("내 할 일 조회 실패가 성공한 추천과 캘린더를 가리지 않는다", async () => {
    query.getChecklist.mockRejectedValue(new Error("비공개 서버 오류"));
    mount();
    await screen.findByText("일정을 확인하지 못했어요.");
    expect(
      await within(recommendationRegion()).findByRole("heading", {
        name: "웨딩홀 투어",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("table", { name: "2026년 10월 달력" }),
    ).toBeTruthy();
    expect(screen.queryByText("비공개 서버 오류")).toBeNull();
  });

  it("내 할 일 오류만 재시도하고 성공한 추천을 다시 요청하지 않는다", async () => {
    query.getChecklist.mockRejectedValue(new Error("조회 실패"));
    mount();
    const region = screen.getByRole("region", { name: "날짜를 정할 일" });
    await within(region).findByText(/내 할 일을 불러오지 못했어요/);
    const recommendationCount =
      recommended.getRecommendedCatalogItems.mock.calls.length;
    query.getChecklist.mockResolvedValue(checklist);
    fireEvent.click(within(region).getByRole("button", { name: "다시 시도" }));
    await within(
      screen.getByRole("region", { name: "날짜를 정할 일" }),
    ).findByRole("heading", { name: "내 할 일 1" });
    expect(recommended.getRecommendedCatalogItems).toHaveBeenCalledTimes(
      recommendationCount,
    );
    expect(
      within(recommendationRegion()).getByRole("heading", {
        name: "웨딩홀 투어",
      }),
    ).toBeTruthy();
  });

  it.each(["checklist", "recommendation"] as const)(
    "%s 인증 오류에서 세션을 갱신하고 캘린더를 유지한다",
    async (source) => {
      if (source === "checklist")
        query.getChecklist.mockRejectedValue(
          new ChecklistQueryAuthenticationRequiredError(),
        );
      else
        recommended.getRecommendedCatalogItems.mockRejectedValue(
          new RecommendedCatalogItemsAuthenticationRequiredError(),
        );
      mount();
      await waitFor(() => expect(refreshAuth).toHaveBeenCalledTimes(1));
      expect(
        screen.getByRole("table", { name: "2026년 10월 달력" }),
      ).toBeTruthy();
    },
  );

  it.each(["checklist", "recommendation"] as const)(
    "%s 호출자 취소를 조회 오류나 인증 만료로 표시하지 않는다",
    async (source) => {
      if (source === "checklist")
        query.getChecklist.mockRejectedValue(
          new ChecklistQueryRequestAbortedError(),
        );
      else
        recommended.getRecommendedCatalogItems.mockRejectedValue(
          new RecommendedCatalogItemsRequestAbortedError(),
        );
      mount();
      await act(async () => undefined);
      expect(refreshAuth).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByText(/내 할 일을 불러오지 못했어요/)).toBeNull();
    },
  );

  it("unmount 시 진행 중인 체크리스트와 추천 요청을 취소하고 늦은 응답을 무시한다", async () => {
    const items = deferred<ChecklistQueryModel>();
    const suggestions = deferred<(typeof recommendedItem)[]>();
    query.getChecklist.mockReturnValue(items.promise);
    recommended.getRecommendedCatalogItems.mockReturnValue(suggestions.promise);
    const { unmount } = mount();
    const querySignal = currentQuerySignal();
    const recommendationSignal = currentRecommendationSignal();
    expect(querySignal.aborted).toBe(false);
    expect(recommendationSignal.aborted).toBe(false);
    unmount();
    expect(querySignal.aborted).toBe(true);
    expect(recommendationSignal.aborted).toBe(true);
    await act(async () => {
      items.resolve(checklistWithSchedule("해제 뒤 일정"));
      suggestions.resolve([recommendedItem]);
    });
    expect(screen.queryByRole("table")).toBeNull();
    expect(refreshAuth).not.toHaveBeenCalled();
  });

  it("추천 저장소가 교체되면 이전 요청을 취소하고 늦은 응답을 무시한다", async () => {
    const previous = deferred<(typeof recommendedItem)[]>();
    recommended.getRecommendedCatalogItems.mockReturnValue(previous.promise);
    const view = mount();
    const previousSignal = currentRecommendationSignal();
    const next = {
      getRecommendedCatalogItems: vi
        .fn()
        .mockResolvedValue([{ ...recommendedItem, title: "새 추천" }]),
    };
    view.rerenderFeature(next);
    expect(previousSignal.aborted).toBe(true);
    await screen.findByRole("heading", { name: "새 추천" });
    await act(async () =>
      previous.resolve([{ ...recommendedItem, title: "늦은 추천" }]),
    );
    expect(screen.queryByRole("heading", { name: "늦은 추천" })).toBeNull();
    view.unmount();
    expect(
      (next.getRecommendedCatalogItems.mock.calls.at(-1)![0] as AbortSignal)
        .aborted,
    ).toBe(true);
  });

  it("체크리스트 저장소가 교체되면 이전 요청을 취소하고 늦은 일정을 무시한다", async () => {
    const previous = deferred<ChecklistQueryModel>();
    query.getChecklist.mockReturnValue(previous.promise);
    const view = mount();
    const previousSignal = currentQuerySignal();
    const next = {
      getChecklist: vi.fn().mockResolvedValue(checklistWithSchedule("새 일정")),
    };
    vi.mocked(useChecklistQueryRepository).mockReturnValue(next);
    view.rerenderFeature();
    expect(previousSignal.aborted).toBe(true);
    await within(dateCell()).findByRole("button", { name: /새 일정/ });
    await act(async () => previous.resolve(checklistWithSchedule("늦은 일정")));
    expect(
      within(dateCell()).queryByRole("button", { name: /늦은 일정/ }),
    ).toBeNull();
    view.unmount();
    expect(
      (next.getChecklist.mock.calls.at(-1)![1] as AbortSignal).aborted,
    ).toBe(true);
  });

  it.each(["guest", "synchronizing"] as const)(
    "동일 저장소에서 %s 상태 후 재로그인해도 이전 일정과 입력창을 다시 표시하지 않는다",
    async (status) => {
      checklist = {
        categories: [
          {
            id: "1",
            title: "웨딩홀",
            items: [
              ...checklistWithSchedule("이전 세션 일정").categories[0].items!,
              task(2, 102),
            ],
          },
        ],
      };
      const view = mount();
      await within(dateCell()).findByRole("button", { name: /이전 세션 일정/ });
      fireEvent.click(screen.getByRole("button", { name: "일정 추가" }));
      await screen.findByRole("textbox", { name: /제목/ });
      const next = deferred<ChecklistQueryModel>();
      query.getChecklist.mockReturnValue(next.promise);
      setAuth(status);
      view.rerenderFeature();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(
        within(dateCell()).queryByRole("button", { name: /이전 세션 일정/ }),
      ).toBeNull();
      const queryCount = query.getChecklist.mock.calls.length;
      if (status === "synchronizing") {
        expect(
          recommended.getRecommendedCatalogItems.mock.calls.every(
            ([signal]) => signal.aborted,
          ),
        ).toBe(true);
      }
      setAuth("authenticated");
      view.rerenderFeature();
      expect(query.getChecklist.mock.calls.length).toBeGreaterThan(queryCount);
      expect(
        within(dateCell()).queryByRole("button", { name: /이전 세션 일정/ }),
      ).toBeNull();
      await act(async () =>
        next.resolve(checklistWithSchedule("재로그인 후 일정")),
      );
      await within(dateCell()).findByRole("button", {
        name: /재로그인 후 일정/,
      });
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  it("사용자가 바뀌면 이전 조회를 취소하고 늦은 개인 데이터와 추천을 버린다", async () => {
    const previousItems = deferred<ChecklistQueryModel>();
    const previousSuggestions = deferred<(typeof recommendedItem)[]>();
    query.getChecklist.mockReturnValue(previousItems.promise);
    recommended.getRecommendedCatalogItems.mockReturnValue(
      previousSuggestions.promise,
    );
    const view = mount();
    const querySignal = currentQuerySignal();
    const recommendationSignal = currentRecommendationSignal();
    query.getChecklist.mockResolvedValue(
      checklistWithSchedule("새 사용자 일정"),
    );
    recommended.getRecommendedCatalogItems.mockResolvedValue([
      { ...recommendedItem, title: "새 사용자 추천" },
    ]);
    setAuth("authenticated", 2);
    view.rerenderFeature();
    expect(querySignal.aborted).toBe(true);
    expect(recommendationSignal.aborted).toBe(true);
    await within(dateCell()).findByRole("button", { name: /새 사용자 일정/ });
    await screen.findByRole("heading", { name: "새 사용자 추천" });
    await act(async () => {
      previousItems.resolve(checklistWithSchedule("이전 사용자 일정"));
      previousSuggestions.resolve([
        { ...recommendedItem, title: "이전 사용자 추천" },
      ]);
    });
    expect(
      within(dateCell()).queryByRole("button", { name: /이전 사용자 일정/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "이전 사용자 추천" }),
    ).toBeNull();
  });

  it("비로그인 조회는 기존 로컬 체크리스트를 사용하고 개인 추천·일정 API를 호출하지 않는다", async () => {
    setAuth("guest");
    checklist.categories[0].items = [];
    mount();
    await screen.findByRole("heading", { name: "웨딩홀 투어" });
    expect(query.getChecklist).toHaveBeenCalledWith(
      "guest",
      expect.any(AbortSignal),
    );
    expect(recommended.getRecommendedCatalogItems).not.toHaveBeenCalled();
    expect(cache.getChecklist).not.toHaveBeenCalled();
    expect(command.createAppointment).not.toHaveBeenCalled();
  });
});

describe("캘린더 추천 담기의 기존 인증·요청·성공 이벤트 계약", () => {
  beforeEach(() => {
    checklist.categories[0].items = [task(1, 100)];
  });

  it("추천을 담으면 목록을 갱신하고 실제 추가 성공 이벤트를 한 번 전송한다", async () => {
    mount();
    await screen.findByRole("button", { name: "내 할 일에 추가" });
    const queryCount = query.getChecklist.mock.calls.length;
    const recommendationCount =
      recommended.getRecommendedCatalogItems.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "내 할 일에 추가" }));
    await waitFor(() => {
      expect(analytics.track).toHaveBeenCalledTimes(1);
      expect(query.getChecklist).toHaveBeenCalledTimes(queryCount + 1);
      expect(recommended.getRecommendedCatalogItems).toHaveBeenCalledTimes(
        recommendationCount + 1,
      );
      expect(
        screen.queryByRole("button", { name: "내 할 일에 추가" }),
      ).toBeNull();
    });
    expect(analytics.track).toHaveBeenCalledWith({
      name: "preparation_item_add",
      parameters: {
        category_name: "웨딩홀",
        item_count: 1,
        phase: 1,
        source: "calendar_recommendation",
      },
    });
    expect(addition.addCatalogItemIds).toHaveBeenCalledWith(
      "authenticated",
      ["101"],
      expect.any(AbortSignal),
    );
  });

  it("이미 추가된 항목 응답이면 성공 이벤트를 중복 전송하지 않는다", async () => {
    addition.addCatalogItemIds.mockResolvedValue([]);
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "내 할 일에 추가" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "추가 중..." })).toBeNull(),
    );
    expect(analytics.track).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "내 할 일에 추가" }),
    ).toBeNull();
  });

  it("추천 추가 인증 만료는 세션을 갱신하고 오류 후 같은 항목을 재시도할 수 있다", async () => {
    addition.addCatalogItemIds.mockRejectedValueOnce(
      new PreparationAuthenticationRequiredError(),
    );
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "내 할 일에 추가" }),
    );
    await waitFor(() => expect(refreshAuth).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert").textContent).toContain(
      "로그인이 만료됐어요",
    );
    expect(analytics.track).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(analytics.track).toHaveBeenCalledTimes(1));
    expect(addition.addCatalogItemIds).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["resolve", "reject"] as const)(
    "추가 요청은 unmount 시 취소하고 뒤늦은 %s에서 갱신·이벤트를 실행하지 않는다",
    async (outcome) => {
      const request = deferred<string[]>();
      addition.addCatalogItemIds.mockReturnValue(request.promise);
      const view = mount();
      fireEvent.click(
        await screen.findByRole("button", { name: "내 할 일에 추가" }),
      );
      const signal = addition.addCatalogItemIds.mock.calls[0][2] as AbortSignal;
      const queryCount = query.getChecklist.mock.calls.length;
      const recommendationCount =
        recommended.getRecommendedCatalogItems.mock.calls.length;
      view.unmount();
      expect(signal.aborted).toBe(true);
      await act(async () => {
        if (outcome === "resolve") request.resolve(["101"]);
        else request.reject(new PreparationAuthenticationRequiredError());
      });
      expect(analytics.track).not.toHaveBeenCalled();
      expect(refreshAuth).not.toHaveBeenCalled();
      expect(query.getChecklist).toHaveBeenCalledTimes(queryCount);
      expect(recommended.getRecommendedCatalogItems).toHaveBeenCalledTimes(
        recommendationCount,
      );
    },
  );

  it("인증 대상이 바뀌면 진행 중인 추가를 취소하고 새 사용자가 같은 항목을 다시 담을 수 있다", async () => {
    const previous = deferred<string[]>();
    addition.addCatalogItemIds.mockReturnValueOnce(previous.promise);
    const view = mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "내 할 일에 추가" }),
    );
    const previousSignal = addition.addCatalogItemIds.mock
      .calls[0][2] as AbortSignal;
    setAuth("authenticated", 2);
    view.rerenderFeature();
    expect(previousSignal.aborted).toBe(true);
    await screen.findByRole("button", { name: "내 할 일에 추가" });
    const queryCount = query.getChecklist.mock.calls.length;
    const recommendationCount =
      recommended.getRecommendedCatalogItems.mock.calls.length;
    await act(async () => previous.resolve(["101"]));
    expect(analytics.track).not.toHaveBeenCalled();
    expect(query.getChecklist).toHaveBeenCalledTimes(queryCount);
    expect(recommended.getRecommendedCatalogItems).toHaveBeenCalledTimes(
      recommendationCount,
    );
    fireEvent.click(screen.getByRole("button", { name: "내 할 일에 추가" }));
    await waitFor(() => expect(analytics.track).toHaveBeenCalledTimes(1));
    expect(addition.addCatalogItemIds).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("캘린더 일정 폼의 공용 입력·레이어 계약", () => {
  it.each([false, true])(
    "모바일=%s에서 취소 후 진입 버튼과 스크롤을 복원한다",
    async (mobile) => {
      installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
      checklist.categories[0].items = [task(1, 101)];
      mount();
      const trigger = await screen.findByRole("button", { name: "일정 추가" });
      trigger.focus();
      fireEvent.click(trigger);
      const layer = await screen.findByRole("dialog", {
        name: "내 할 일 1 일정 추가",
      });
      expect(layer.getAttribute("data-placement")).toBe(
        mobile ? "fullscreen" : "side",
      );
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole("textbox", { name: /제목/ }),
        ),
      );
      const scroll = document.querySelector<HTMLElement>(
        "[data-page-scroll-container]",
      )!;
      expect(document.body.style.overflow).toBe("hidden");
      expect(scroll.style.overflow).toBe("hidden");
      for (const type of ["pointerdown", "pointerup", "click"])
        fireEvent(layer, new MouseEvent(type, { bubbles: true, button: 0 }));
      expect(screen.getByRole("dialog", { name: "내 할 일 1 일정 추가" })).toBe(
        layer,
      );
      fireEvent.change(screen.getByRole("textbox", { name: /제목/ }), {
        target: { value: "작성 중" },
      });
      const last = within(layer).getByRole("button", { name: "저장" });
      last.focus();
      fireEvent.keyDown(last, { key: "Tab" });
      expect(layer.contains(document.activeElement)).toBe(true);
      fireEvent.click(
        within(layer).getByRole("button", {
          name: mobile ? "캘린더로 돌아가기" : "일정 추가 닫기",
        }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      expect(scroll.style.overflow).toBe("auto");
      expect(document.body.style.overflow).not.toBe("hidden");
      expect(command.createAppointment).not.toHaveBeenCalled();
    },
  );

  it("날짜 필수 오류를 선택 버튼에 연결하고 초점을 이동한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    checklist.categories[0].items = [task(1, 101)];
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "일정 추가" }));
    await screen.findByRole("textbox", { name: /제목/ });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    const date = screen.getByRole("button", { name: "날짜 날짜 선택" });
    await waitFor(() => expect(document.activeElement).toBe(date));
    expect(screen.getByRole("alert").textContent).toBe("날짜를 선택해 주세요.");
    expect(command.createAppointment).not.toHaveBeenCalled();
  });

  it("저장 실패 후 입력과 오류 초점을 유지하고 같은 요청으로 재시도한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    checklist.categories[0].items = [task(1, 101)];
    command.createAppointment.mockRejectedValueOnce(new Error("save failed"));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "일정 추가" }));
    await screen.findByRole("textbox", { name: /제목/ });
    await chooseDate(localToday());
    const title = screen.getByRole("textbox", { name: /제목/ });
    fireEvent.change(title, { target: { value: "방문 상담" } });
    fireEvent.change(screen.getByRole("textbox", { name: "장소" }), {
      target: { value: "상담실" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "메모" }), {
      target: { value: "작성한 메모" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await screen.findByRole("button", { name: "다시 시도" });
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe(
        "일정을 저장하지 못했어요. 다시 시도해 주세요.",
      ),
    );
    expect((title as HTMLInputElement).value).toBe("방문 상담");
    expect(
      (screen.getByRole("textbox", { name: "메모" }) as HTMLTextAreaElement)
        .value,
    ).toBe("작성한 메모");
    expect(command.createAppointment.mock.calls[0][1]).toMatchObject({
      date: localToday(),
      title: "방문 상담",
      startTime: null,
      endTime: null,
      place: "상담실",
      memo: "작성한 메모",
    });
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(command.createAppointment).toHaveBeenCalledTimes(2);
    expect(command.createAppointment.mock.calls[1][1]).toEqual(
      command.createAppointment.mock.calls[0][1],
    );
  });

  it("저장 중에는 중복 실행과 Escape·취소·닫기를 막는다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    checklist.categories[0].items = [task(1, 101)];
    const pending = deferred<void>();
    command.createAppointment.mockReturnValue(pending.promise);
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "일정 추가" }));
    await screen.findByRole("textbox", { name: /제목/ });
    await chooseDate(localToday());
    const save = screen.getByRole("button", { name: "저장" });
    fireEvent.click(save);
    fireEvent.click(save);
    const layer = screen.getByRole("dialog", { name: "내 할 일 1 일정 추가" });
    expect(
      (screen.getByRole("button", { name: "저장 중" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "취소" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "일정 추가 닫기" }));
    fireEvent.keyDown(layer, { key: "Escape" });
    fireEvent(layer, new Event("cancel", { bubbles: true, cancelable: true }));
    expect((layer as HTMLDialogElement).open).toBe(true);
    expect(command.createAppointment).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("선택기의 Escape와 화면 크기 전환이 작성 중인 폼을 닫거나 초기화하지 않는다", async () => {
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    checklist.categories[0].items = [task(1, 101)];
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "일정 추가" }));
    const title = await screen.findByRole("textbox", { name: /제목/ });
    fireEvent.change(title, { target: { value: "작성 중인 제목" } });
    await chooseDate(localToday());
    const trigger = screen.getByRole("button", { name: "시작 시간 시간 선택" });
    trigger.focus();
    fireEvent.click(trigger);
    let picker = screen.getByRole("dialog", { name: "시작 시간 선택" });
    fireEvent.keyDown(within(picker).getByRole("listbox", { name: "시" }), {
      key: "Escape",
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "시작 시간 선택" }),
      ).toBeNull(),
    );
    expect(document.activeElement).toBe(trigger);
    const layer = screen.getByRole("dialog", { name: "내 할 일 1 일정 추가" });
    act(() => media.setMatches(true));
    expect(layer.getAttribute("data-placement")).toBe("fullscreen");
    expect(screen.getByRole("textbox", { name: /제목/ })).toBe(title);
    expect((title as HTMLInputElement).value).toBe("작성 중인 제목");
    expect(
      screen.getByRole("button", { name: `날짜 ${localToday()}` }),
    ).toBeTruthy();
    const mobileTrigger = screen.getByRole("button", {
      name: "시작 시간 시간 선택",
    });
    mobileTrigger.focus();
    fireEvent.click(mobileTrigger);
    picker = screen.getByRole("dialog", { name: "시작 시간 선택" });
    const confirm = within(picker).getByRole("button", { name: "확인" });
    confirm.focus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(picker.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(within(picker).getByRole("listbox", { name: "시" }), {
      key: "Escape",
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "시작 시간 선택" }),
      ).toBeNull(),
    );
    expect(screen.getByRole("dialog", { name: "내 할 일 1 일정 추가" })).toBe(
      layer,
    );
    expect(document.activeElement).toBe(mobileTrigger);
    fireEvent.keyDown(title, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("퇴장이 끝날 때까지 입력 화면과 스크롤 잠금을 유지한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    checklist.categories[0].items = [task(1, 101)];
    mount();
    const entry = await screen.findByRole("button", { name: "일정 추가" });
    entry.focus();
    fireEvent.click(entry);
    const title = await screen.findByRole("textbox", { name: /제목/ });
    fireEvent.change(title, { target: { value: "퇴장 중에도 보존" } });
    const layer = screen.getByRole("dialog", { name: "내 할 일 1 일정 추가" });
    const surface = layer.querySelector<HTMLElement>(
      ".bibbidi-panel-overlay-surface",
    )!;
    const exit = deferred<void>();
    surface.getAnimations = () => [
      { finished: exit.promise } as unknown as Animation,
    ];
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(layer.getAttribute("data-state")).toBe("closing");
    expect((title as HTMLInputElement).value).toBe("퇴장 중에도 보존");
    expect(document.body.style.overflow).toBe("hidden");
    expect(surface.hasAttribute("inert")).toBe(true);
    await act(async () => exit.resolve());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(entry));
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
