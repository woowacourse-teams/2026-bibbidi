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
    requireAccountSetup: vi.fn(),
  });
}
function mount(entry = "/calendar") {
  const ui = (repository: RecommendedCatalogItemsRepository) => (
    <StrictMode>
      <MemoryRouter initialEntries={[entry]}>
        <HomeScheduleDashboardFeature
          getReferenceDate={() => "2026-10-05"}
          recommendedRepository={repository}
        />
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

  it("날짜 없는 목록은 조회 순서대로 최대 3개를 표시하고 나머지는 체크리스트로 연결한다", async () => {
    checklist.categories[0].items = [
      task(4, 104),
      task(3, 103),
      task(2, 102),
      task(1, 100),
    ];
    mount();
    const region = await screen.findByRole("region", {
      name: "날짜를 정할 일 4개",
    });
    expect(
      within(region)
        .getAllByRole("heading", { level: 3 })
        .map((node) => node.textContent),
    ).toEqual(["내 할 일 4", "내 할 일 3", "내 할 일 2"]);
    expect(within(region).queryByText("내 할 일 1")).toBeNull();
    expect(
      within(region)
        .getByRole("link", { name: "나머지 1개 전체 보기" })
        .getAttribute("href"),
    ).toBe("/checklist");
  });

  it("조회 중에는 빈 상태를 표시하지 않고 응답 이후 실제 목록으로 전환한다", async () => {
    const request = deferred<ChecklistQueryModel>();
    query.getChecklist.mockReturnValue(request.promise);
    mount();
    expect(screen.getByText("내 할 일을 불러오는 중")).toBeTruthy();
    expect(screen.queryByText("날짜를 정할 할 일이 없어요.")).toBeNull();
    await act(async () => undefined);
    expect(screen.getByText("추천 할 일을 불러오는 중")).toBeTruthy();
    expect(screen.queryByText("지금 추가할 추천 항목이 없어요.")).toBeNull();
    await act(async () => request.resolve(checklist));
    await screen.findByRole("region", { name: "날짜를 정할 일 1개" });
    expect(screen.queryByText("내 할 일을 불러오는 중")).toBeNull();
  });

  it("완료 항목만 있으면 날짜 없는 목록을 빈 상태로 표시한다", async () => {
    checklist.categories[0].items = [task(1, 100, [], "done")];
    mount();
    await screen.findByText("날짜를 정할 할 일이 없어요.");
    expect(
      screen.queryByText("아래 추천에서 필요한 준비를 담아보세요."),
    ).toBeNull();
    expect(
      screen.getByRole("region", { name: "날짜를 정할 일 0개" }),
    ).toBeTruthy();
  });

  it("추천 조회 중 상태를 표시하고 API 순서를 유지한 목록으로 전환한다", async () => {
    const request = deferred<(typeof recommendedItem)[]>();
    recommended.getRecommendedCatalogItems.mockReturnValue(request.promise);
    mount();
    expect(screen.getByText("추천 할 일을 불러오는 중")).toBeTruthy();
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
    expect(screen.queryByText("추천 할 일을 불러오는 중")).toBeNull();
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
    await screen.findByText(/내 할 일과 일정을 불러오지 못했어요/);
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
    await screen.findByRole("region", { name: "날짜를 정할 일 1개" });
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
    await waitFor(() => expect(analytics.track).toHaveBeenCalledTimes(1));
    expect(analytics.track).toHaveBeenCalledWith({
      name: "preparation_item_add",
      parameters: {
        category_name: "웨딩홀",
        item_count: 1,
        phase: 1,
        source: "calendar_recommendation",
      },
    });
    expect(query.getChecklist).toHaveBeenCalledTimes(queryCount + 1);
    expect(recommended.getRecommendedCatalogItems).toHaveBeenCalledTimes(
      recommendationCount + 1,
    );
    expect(addition.addCatalogItemIds).toHaveBeenCalledWith(
      "authenticated",
      ["101"],
      expect.any(AbortSignal),
    );
    expect(
      screen.queryByRole("button", { name: "내 할 일에 추가" }),
    ).toBeNull();
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
