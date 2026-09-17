import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../auth";
import {
  PreparationAuthenticationRequiredError,
  usePreparationChecklistRepository,
} from "../preparation";
import type { ChecklistRepository } from "../preparation";
import { HomeScheduleDashboardFeature } from "./HomeScheduleDashboardFeature";
import {
  NearbyAppointmentsAuthenticationRequiredError,
  NearbyAppointmentsRepository,
  NearbyAppointmentsRequestAbortedError,
} from "./repository/nearbyAppointmentsRepository";
import {
  RecommendedCatalogItemsAuthenticationRequiredError,
  RecommendedCatalogItemsRepository,
  RecommendedCatalogItemsRequestAbortedError,
} from "./repository/recommendedCatalogItemsRepository";
import {
  UnscheduledTasksAuthenticationRequiredError,
  UnscheduledTasksRepository,
  UnscheduledTasksRequestAbortedError,
} from "./repository/unscheduledTasksRepository";

const analyticsMocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("../../infrastructure/analytics", () => ({
  analytics: { initialize: vi.fn(), track: analyticsMocks.track },
}));

vi.mock("../auth", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../preparation", () => ({
  PreparationAuthenticationRequiredError: class extends Error {},
  usePreparationChecklistRepository: vi.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="dashboard-location">{`${location.pathname}${location.search}`}</output>
  );
}

function render(ui: Parameters<typeof rtlRender>[0]) {
  const result = rtlRender(
    <MemoryRouter initialEntries={["/planner"]}>
      {ui}
      <LocationProbe />
    </MemoryRouter>,
  );

  return {
    ...result,
    rerender(nextUi: Parameters<typeof rtlRender>[0]) {
      result.rerender(
        <MemoryRouter initialEntries={["/planner"]}>
          {nextUi}
          <LocationProbe />
        </MemoryRouter>,
      );
    },
  };
}

const checklistRepository: ChecklistRepository = {
  addCatalogItemIds: vi.fn().mockResolvedValue([]),
  getCatalogItemIds: vi.fn().mockResolvedValue([]),
};

const refreshAuth = vi.fn();

function createRepository(): NearbyAppointmentsRepository {
  return {
    getNearbyAppointments: vi.fn().mockResolvedValue([]),
  };
}

function createUnscheduledRepository(): UnscheduledTasksRepository {
  return {
    getUnscheduledTasks: vi.fn().mockResolvedValue([]),
  };
}

function createRecommendedRepository(): RecommendedCatalogItemsRepository {
  return { getRecommendedCatalogItems: vi.fn().mockResolvedValue([]) };
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolveRequest) => {
    resolve = resolveRequest;
  });

  return { promise, resolve };
}

beforeEach(() => {
  analyticsMocks.track.mockReset();
  refreshAuth.mockReset();
  vi.mocked(usePreparationChecklistRepository).mockReturnValue(
    checklistRepository,
  );
  vi.mocked(checklistRepository.addCatalogItemIds)
    .mockReset()
    .mockResolvedValue([]);
  vi.mocked(useAuth).mockReturnValue({
    authState: { status: "authenticated", user: { nickname: "비비디" } },
    beginAuthentication: vi.fn(),
    completeAuthentication: vi.fn(),
    endAuthentication: vi.fn(),
    refreshAuth,
  });
});

describe("HomeScheduleDashboardFeature", () => {
  it("Loading에서 API 순서를 유지한 Complete 목록으로 전환한다", async () => {
    let resolveRequest: Parameters<
      ConstructorParameters<
        typeof Promise<
          Awaited<
            ReturnType<NearbyAppointmentsRepository["getNearbyAppointments"]>
          >
        >
      >[0]
    >[0] = () => undefined;
    const repository = createRepository();
    const unscheduledRepository = createUnscheduledRepository();
    vi.mocked(repository.getNearbyAppointments).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(
      <HomeScheduleDashboardFeature
        recommendedRepository={createRecommendedRepository()}
        getReferenceDate={() => "2026-09-16"}
        nearbyRepository={repository}
        unscheduledRepository={unscheduledRepository}
      />,
    );

    expect(screen.getByText("가까운 일정을 불러오는 중입니다.")).toBeTruthy();
    expect(
      screen.getByText("일정이 필요한 할 일을 불러오는 중입니다."),
    ).toBeTruthy();
    expect(unscheduledRepository.getUnscheduledTasks).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRequest([
        {
          date: "2026-09-20",
          id: 2,
          place: "  ",
          startTime: null,
          title: "두 번째 응답",
        },
        {
          date: "2026-09-16",
          id: 1,
          place: "비비디 웨딩홀",
          startTime: "2026-09-16T14:05:00",
          title: "첫 번째 날짜",
        },
      ]);
    });

    const upcomingSection = screen.getByRole("region", {
      name: "가까운 일정",
    });
    expect(within(upcomingSection).queryByText("2개")).toBeNull();
    expect(
      within(upcomingSection)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["두 번째 응답", "첫 번째 날짜"]);
    expect(within(upcomingSection).getAllByText("예정")).toHaveLength(2);
    expect(within(upcomingSection).getByText("4일 뒤")).toBeTruthy();
    expect(
      within(upcomingSection).getByText("시간 미정 · 장소 없음"),
    ).toBeTruthy();
    expect(
      within(upcomingSection).getByText("오후 2:05 · 비비디 웨딩홀"),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "일정이 필요한 할 일" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "추천 할 일" })).toBeTruthy();
  });

  it("빈 응답을 Empty UI로 전환한다", async () => {
    render(
      <HomeScheduleDashboardFeature
        recommendedRepository={createRecommendedRepository()}
        getReferenceDate={() => "2026-09-16"}
        nearbyRepository={createRepository()}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );

    expect(await screen.findByText("예정된 일정이 없어요")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "가까운 일정" })).queryByText(
        "0개",
      ),
    ).toBeNull();
  });

  it("오류를 Error UI로 전환하고 다시 시도한다", async () => {
    const repository = createRepository();
    const unscheduledRepository = createUnscheduledRepository();
    vi.mocked(repository.getNearbyAppointments)
      .mockRejectedValueOnce(new Error("서버 내부 메시지"))
      .mockResolvedValueOnce([]);

    render(
      <HomeScheduleDashboardFeature
        recommendedRepository={createRecommendedRepository()}
        getReferenceDate={() => "2026-09-16"}
        nearbyRepository={repository}
        unscheduledRepository={unscheduledRepository}
      />,
    );

    expect(await screen.findByText("일정을 불러오지 못했어요")).toBeTruthy();
    expect(screen.queryByText("서버 내부 메시지")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("예정된 일정이 없어요")).toBeTruthy();
    expect(repository.getNearbyAppointments).toHaveBeenCalledTimes(2);
    expect(unscheduledRepository.getUnscheduledTasks).toHaveBeenCalledOnce();
  });

  it("인증 오류에서 refreshAuth를 호출한다", async () => {
    const repository = createRepository();
    vi.mocked(repository.getNearbyAppointments).mockRejectedValue(
      new NearbyAppointmentsAuthenticationRequiredError(),
    );

    render(
      <HomeScheduleDashboardFeature
        recommendedRepository={createRecommendedRepository()}
        getReferenceDate={() => "2026-09-16"}
        nearbyRepository={repository}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );

    await act(async () => undefined);

    expect(refreshAuth).toHaveBeenCalledOnce();
    expect(screen.queryByText("일정을 불러오지 못했어요")).toBeNull();
  });

  it("unmount 시 진행 중인 요청을 취소한다", () => {
    const repository = createRepository();
    const unscheduledRepository = createUnscheduledRepository();
    vi.mocked(repository.getNearbyAppointments).mockReturnValue(
      new Promise(() => undefined),
    );
    vi.mocked(unscheduledRepository.getUnscheduledTasks).mockReturnValue(
      new Promise(() => undefined),
    );
    const { unmount } = render(
      <HomeScheduleDashboardFeature
        recommendedRepository={createRecommendedRepository()}
        nearbyRepository={repository}
        unscheduledRepository={unscheduledRepository}
      />,
    );
    const signal = vi.mocked(repository.getNearbyAppointments).mock.calls[0][0];
    const unscheduledSignal = vi.mocked(
      unscheduledRepository.getUnscheduledTasks,
    ).mock.calls[0][0];

    expect(signal?.aborted).toBe(false);
    expect(unscheduledSignal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
    expect(unscheduledSignal?.aborted).toBe(true);
  });

  it("일정이 필요한 할 일의 Loading에서 API 순서와 상태 라벨을 유지한 Complete 목록으로 전환한다", async () => {
    const deferred =
      createDeferred<
        Awaited<ReturnType<UnscheduledTasksRepository["getUnscheduledTasks"]>>
      >();
    const nearbyRepository = createRepository();
    const unscheduledRepository = createUnscheduledRepository();
    vi.mocked(unscheduledRepository.getUnscheduledTasks).mockReturnValue(
      deferred.promise,
    );

    render(
      <HomeScheduleDashboardFeature
        recommendedRepository={createRecommendedRepository()}
        nearbyRepository={nearbyRepository}
        unscheduledRepository={unscheduledRepository}
      />,
    );

    expect(
      screen.getByText("일정이 필요한 할 일을 불러오는 중입니다."),
    ).toBeTruthy();
    expect(await screen.findByText("예정된 일정이 없어요")).toBeTruthy();

    await act(async () => {
      deferred.resolve([
        {
          category: "가족",
          id: 44,
          status: "continue",
          title: "부모님께 인사",
        },
        { category: "웨딩홀", id: 31, status: "prev", title: "웨딩홀 투어" },
        { category: "예식", id: 52, status: "prev", title: "식순 준비" },
      ]);
    });

    const section = screen.getByRole("region", {
      name: "일정이 필요한 할 일",
    });
    expect(within(section).queryByText("3개")).toBeNull();
    expect(within(section).getByRole("list").parentElement).toBe(section);
    expect(
      within(section)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["부모님께 인사", "웨딩홀 투어", "식순 준비"]);
    expect(within(section).getByText("진행 중")).toBeTruthy();
    expect(within(section).getAllByText("미완료")).toHaveLength(2);
    expect(within(section).getByText("가족")).toBeTruthy();
    expect(within(section).getByText("웨딩홀")).toBeTruthy();
    const addLinks = within(section).getAllByRole("link", {
      name: "일정 추가",
    });
    expect(addLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/checklist?taskId=checklist-item-44&addAppointment=true",
      "/checklist?taskId=checklist-item-31&addAppointment=true",
      "/checklist?taskId=checklist-item-52&addAppointment=true",
    ]);
    fireEvent.click(addLinks[0]);
    expect(screen.getByTestId("dashboard-location").textContent).toBe(
      "/checklist?taskId=checklist-item-44&addAppointment=true",
    );
  });

  it("일정이 필요한 할 일의 빈 응답을 Empty UI로 전환한다", async () => {
    render(
      <HomeScheduleDashboardFeature
        recommendedRepository={createRecommendedRepository()}
        nearbyRepository={createRepository()}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );

    expect(
      await screen.findByText("일정이 필요한 할 일이 없어요"),
    ).toBeTruthy();
    expect(
      within(
        screen.getByRole("region", { name: "일정이 필요한 할 일" }),
      ).queryByText("0개"),
    ).toBeNull();
  });

  it("일정이 필요한 할 일 오류만 재시도하고 가까운 일정 결과를 유지한다", async () => {
    const nearbyRepository = createRepository();
    const unscheduledRepository = createUnscheduledRepository();
    vi.mocked(unscheduledRepository.getUnscheduledTasks)
      .mockRejectedValueOnce(new Error("서버 내부 메시지"))
      .mockResolvedValueOnce([]);

    render(
      <HomeScheduleDashboardFeature
        recommendedRepository={createRecommendedRepository()}
        nearbyRepository={nearbyRepository}
        unscheduledRepository={unscheduledRepository}
      />,
    );

    expect(await screen.findByText("할 일을 불러오지 못했어요")).toBeTruthy();
    expect(await screen.findByText("예정된 일정이 없어요")).toBeTruthy();
    expect(screen.queryByText("서버 내부 메시지")).toBeNull();
    fireEvent.click(
      within(
        screen.getByRole("region", { name: "일정이 필요한 할 일" }),
      ).getByRole("button", { name: "다시 시도" }),
    );

    expect(
      await screen.findByText("일정이 필요한 할 일이 없어요"),
    ).toBeTruthy();
    expect(screen.getByText("예정된 일정이 없어요")).toBeTruthy();
    expect(nearbyRepository.getNearbyAppointments).toHaveBeenCalledOnce();
    expect(unscheduledRepository.getUnscheduledTasks).toHaveBeenCalledTimes(2);
  });

  it("가까운 일정 오류가 일정이 필요한 할 일의 정상 결과를 숨기지 않는다", async () => {
    const nearbyRepository = createRepository();
    const unscheduledRepository = createUnscheduledRepository();
    vi.mocked(nearbyRepository.getNearbyAppointments).mockRejectedValue(
      new Error("일정 서버 오류"),
    );
    vi.mocked(unscheduledRepository.getUnscheduledTasks).mockResolvedValue([
      { category: "웨딩홀", id: 31, status: "prev", title: "웨딩홀 투어" },
    ]);

    render(
      <HomeScheduleDashboardFeature
        recommendedRepository={createRecommendedRepository()}
        nearbyRepository={nearbyRepository}
        unscheduledRepository={unscheduledRepository}
      />,
    );

    expect(await screen.findByText("일정을 불러오지 못했어요")).toBeTruthy();
    expect(await screen.findByText("웨딩홀 투어")).toBeTruthy();
  });

  it("일정이 필요한 할 일 인증 오류에서 refreshAuth를 호출한다", async () => {
    const unscheduledRepository = createUnscheduledRepository();
    vi.mocked(unscheduledRepository.getUnscheduledTasks).mockRejectedValue(
      new UnscheduledTasksAuthenticationRequiredError(),
    );

    render(
      <HomeScheduleDashboardFeature
        recommendedRepository={createRecommendedRepository()}
        nearbyRepository={createRepository()}
        unscheduledRepository={unscheduledRepository}
      />,
    );
    await act(async () => undefined);

    expect(refreshAuth).toHaveBeenCalledOnce();
    expect(screen.queryByText("할 일을 불러오지 못했어요")).toBeNull();
  });

  it("호출자 취소는 어느 영역에서도 오류로 표시하지 않는다", async () => {
    const nearbyRepository = createRepository();
    const unscheduledRepository = createUnscheduledRepository();
    vi.mocked(nearbyRepository.getNearbyAppointments).mockRejectedValue(
      new NearbyAppointmentsRequestAbortedError(),
    );
    vi.mocked(unscheduledRepository.getUnscheduledTasks).mockRejectedValue(
      new UnscheduledTasksRequestAbortedError(),
    );

    render(
      <HomeScheduleDashboardFeature
        recommendedRepository={createRecommendedRepository()}
        nearbyRepository={nearbyRepository}
        unscheduledRepository={unscheduledRepository}
      />,
    );
    await act(async () => undefined);

    expect(screen.queryByText("일정을 불러오지 못했어요")).toBeNull();
    expect(screen.queryByText("할 일을 불러오지 못했어요")).toBeNull();
  });

  it("요청 교체 시 이전 요청을 취소하고 늦은 응답을 무시한다", async () => {
    const previousRequest =
      createDeferred<
        Awaited<ReturnType<UnscheduledTasksRepository["getUnscheduledTasks"]>>
      >();
    const previousRepository = createUnscheduledRepository();
    const nextRepository = createUnscheduledRepository();
    const nearbyRepository = createRepository();
    vi.mocked(previousRepository.getUnscheduledTasks).mockReturnValue(
      previousRequest.promise,
    );
    vi.mocked(nextRepository.getUnscheduledTasks).mockResolvedValue([
      { category: "가족", id: 44, status: "continue", title: "새 응답" },
    ]);

    const { rerender } = render(
      <HomeScheduleDashboardFeature
        recommendedRepository={createRecommendedRepository()}
        nearbyRepository={nearbyRepository}
        unscheduledRepository={previousRepository}
      />,
    );
    const previousSignal = vi.mocked(previousRepository.getUnscheduledTasks)
      .mock.calls[0][0];

    rerender(
      <HomeScheduleDashboardFeature
        recommendedRepository={createRecommendedRepository()}
        nearbyRepository={nearbyRepository}
        unscheduledRepository={nextRepository}
      />,
    );

    expect(previousSignal?.aborted).toBe(true);
    expect(await screen.findByText("새 응답")).toBeTruthy();
    await act(async () => {
      previousRequest.resolve([
        { category: "웨딩홀", id: 31, status: "prev", title: "늦은 응답" },
      ]);
    });
    expect(screen.queryByText("늦은 응답")).toBeNull();
    expect(nearbyRepository.getNearbyAppointments).toHaveBeenCalledOnce();
  });

  it("추천 할 일 Loading에서 API 순서를 유지한 Complete 목록으로 전환한다", async () => {
    const deferred =
      createDeferred<
        Awaited<
          ReturnType<
            RecommendedCatalogItemsRepository["getRecommendedCatalogItems"]
          >
        >
      >();
    const recommendedRepository = createRecommendedRepository();
    vi.mocked(recommendedRepository.getRecommendedCatalogItems).mockReturnValue(
      deferred.promise,
    );

    render(
      <HomeScheduleDashboardFeature
        nearbyRepository={createRepository()}
        recommendedRepository={recommendedRepository}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );

    expect(screen.getByText("추천 할 일을 불러오는 중입니다.")).toBeTruthy();
    expect(await screen.findByText("예정된 일정이 없어요")).toBeTruthy();
    expect(
      await screen.findByText("일정이 필요한 할 일이 없어요"),
    ).toBeTruthy();

    await act(async () => {
      deferred.resolve([
        {
          category: "스드메",
          catalogItemId: 201,
          phase: 2,
          stepName: "스드메 업체 확정",
          title: "드레스샵 확정",
        },
        {
          category: "웨딩홀",
          catalogItemId: 100,
          phase: 1,
          stepName: "웨딩홀 정하기",
          title: "웨딩홀 투어",
        },
      ]);
    });

    const section = screen.getByRole("region", { name: "추천 할 일" });
    expect(
      within(section)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["드레스샵 확정", "웨딩홀 투어"]);
    expect(within(section).getByText("스드메")).toBeTruthy();
    expect(within(section).getByText("스드메 업체 확정")).toBeTruthy();
    expect(within(section).getByText("웨딩홀 정하기")).toBeTruthy();
    expect(within(section).queryByText(/개월 전/)).toBeNull();
    expect(
      within(section).getAllByRole("button", { name: "내 할 일에 추가" }),
    ).toHaveLength(2);
    expect(
      within(section)
        .getByRole("link", { name: "준비 목록 보기" })
        .getAttribute("href"),
    ).toBe("/");
    fireEvent.click(
      within(section).getByRole("link", { name: "준비 목록 보기" }),
    );
    expect(screen.getByTestId("dashboard-location").textContent).toBe("/");
  });

  it("추천 할 일 빈 응답을 Empty UI로 전환한다", async () => {
    render(
      <HomeScheduleDashboardFeature
        nearbyRepository={createRepository()}
        recommendedRepository={createRecommendedRepository()}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );

    expect(await screen.findByText("추천할 일이 없어요")).toBeTruthy();
    expect(screen.getByRole("region", { name: "추천 할 일" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "준비 목록 보기" }).getAttribute("href"),
    ).toBe("/");
    fireEvent.click(screen.getByRole("link", { name: "준비 목록 보기" }));
    expect(screen.getByTestId("dashboard-location").textContent).toBe("/");
  });

  it("추천 항목을 저장소로 추가하고 체크리스트 캐시 흐름을 거쳐 추천 목록만 갱신한다", async () => {
    const recommendedRepository = createRecommendedRepository();
    const item = {
      category: "웨딩홀",
      catalogItemId: 201,
      phase: 1,
      stepName: "웨딩홀 정하기",
      title: "웨딩홀 투어",
    };
    vi.mocked(recommendedRepository.getRecommendedCatalogItems)
      .mockResolvedValueOnce([item])
      .mockResolvedValueOnce([]);
    vi.mocked(checklistRepository.addCatalogItemIds).mockResolvedValueOnce([
      "201",
    ]);

    render(
      <HomeScheduleDashboardFeature
        nearbyRepository={createRepository()}
        recommendedRepository={recommendedRepository}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "내 할 일에 추가" }),
    );
    expect(analyticsMocks.track).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(checklistRepository.addCatalogItemIds).toHaveBeenCalledWith(
        "authenticated",
        ["201"],
        expect.any(AbortSignal),
      ),
    );
    expect(await screen.findByText("추천할 일이 없어요")).toBeTruthy();
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
    expect(analyticsMocks.track).toHaveBeenCalledWith({
      name: "preparation_item_add",
      parameters: {
        category_name: "웨딩홀",
        item_count: 1,
        phase: 1,
        source: "planner_recommendation",
      },
    });
    expect(screen.getByText("예정된 일정이 없어요")).toBeTruthy();
    expect(screen.getByText("일정이 필요한 할 일이 없어요")).toBeTruthy();
  });

  it("추천 항목별 추가 중 중복 클릭을 막고 오류 후 같은 항목을 재시도한다", async () => {
    const recommendedRepository = createRecommendedRepository();
    const item = {
      category: "웨딩홀",
      catalogItemId: 201,
      phase: 1,
      stepName: "웨딩홀 정하기",
      title: "웨딩홀 투어",
    };
    vi.mocked(
      recommendedRepository.getRecommendedCatalogItems,
    ).mockResolvedValue([item]);
    let rejectAddition: (error: Error) => void = () => undefined;
    vi.mocked(checklistRepository.addCatalogItemIds)
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectAddition = reject;
        }),
      )
      .mockResolvedValueOnce(["201"]);

    render(
      <HomeScheduleDashboardFeature
        nearbyRepository={createRepository()}
        recommendedRepository={recommendedRepository}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "내 할 일에 추가" }),
    );
    const pending = screen.getByRole("button", { name: "추가 중..." });
    expect(pending.hasAttribute("disabled")).toBe(true);
    fireEvent.click(pending);
    expect(checklistRepository.addCatalogItemIds).toHaveBeenCalledTimes(1);

    await act(async () => rejectAddition(new Error("서버 내부 메시지")));
    expect(analyticsMocks.track).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(
      "할 일을 추가하지 못했어요. 다시 시도해 주세요.",
    );
    expect(screen.queryByText("서버 내부 메시지")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() =>
      expect(checklistRepository.addCatalogItemIds).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(analyticsMocks.track).toHaveBeenCalledOnce());
    expect(screen.getByText("예정된 일정이 없어요")).toBeTruthy();
  });

  it("이미 추가된 추천 항목 응답은 공통 준비 항목 성공 이벤트를 중복 전송하지 않는다", async () => {
    const recommendedRepository = createRecommendedRepository();
    vi.mocked(
      recommendedRepository.getRecommendedCatalogItems,
    ).mockResolvedValue([
      {
        category: "웨딩홀",
        catalogItemId: 201,
        phase: 1,
        stepName: "웨딩홀 정하기",
        title: "웨딩홀 투어",
      },
    ]);
    vi.mocked(checklistRepository.addCatalogItemIds).mockResolvedValueOnce([]);

    render(
      <HomeScheduleDashboardFeature
        nearbyRepository={createRepository()}
        recommendedRepository={recommendedRepository}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "내 할 일에 추가" }),
    );

    await waitFor(() =>
      expect(checklistRepository.addCatalogItemIds).toHaveBeenCalledOnce(),
    );
    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("추천 추가 인증 만료는 세션을 갱신하고 요청 취소 뒤에는 오류를 표시하지 않는다", async () => {
    const recommendedRepository = createRecommendedRepository();
    vi.mocked(
      recommendedRepository.getRecommendedCatalogItems,
    ).mockResolvedValue([
      {
        category: "웨딩홀",
        catalogItemId: 201,
        phase: 1,
        stepName: "웨딩홀 정하기",
        title: "웨딩홀 투어",
      },
    ]);
    vi.mocked(checklistRepository.addCatalogItemIds).mockRejectedValueOnce(
      new PreparationAuthenticationRequiredError(),
    );
    const { unmount } = render(
      <HomeScheduleDashboardFeature
        nearbyRepository={createRepository()}
        recommendedRepository={recommendedRepository}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "내 할 일에 추가" }),
    );
    await waitFor(() => expect(refreshAuth).toHaveBeenCalledOnce());
    expect(screen.getByRole("alert").textContent).toContain(
      "로그인이 만료됐어요",
    );
    unmount();

    let resolveAddition: (ids: string[]) => void = () => undefined;
    vi.mocked(checklistRepository.addCatalogItemIds).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAddition = resolve;
      }),
    );
    const second = render(
      <HomeScheduleDashboardFeature
        nearbyRepository={createRepository()}
        recommendedRepository={recommendedRepository}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "내 할 일에 추가" }),
    );
    const signal = vi.mocked(checklistRepository.addCatalogItemIds).mock
      .calls[1][2];
    second.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => resolveAddition(["201"]));
    expect(
      recommendedRepository.getRecommendedCatalogItems,
    ).toHaveBeenCalledTimes(2);
  });

  it("인증 대상이 바뀌면 이전 추가 요청과 항목 상태를 버리고 새 세션에서 다시 추가한다", async () => {
    const recommendedRepository = createRecommendedRepository();
    const item = {
      category: "웨딩홀",
      catalogItemId: 201,
      phase: 1,
      stepName: "웨딩홀 정하기",
      title: "웨딩홀 투어",
    };
    vi.mocked(
      recommendedRepository.getRecommendedCatalogItems,
    ).mockResolvedValue([item]);
    let resolvePreviousAddition: (ids: string[]) => void = () => undefined;
    vi.mocked(checklistRepository.addCatalogItemIds)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePreviousAddition = resolve;
        }),
      )
      .mockResolvedValueOnce(["201"]);

    const result = render(
      <HomeScheduleDashboardFeature
        nearbyRepository={createRepository()}
        recommendedRepository={recommendedRepository}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "내 할 일에 추가" }),
    );
    const previousSignal = vi.mocked(checklistRepository.addCatalogItemIds).mock
      .calls[0][2];

    vi.mocked(useAuth).mockReturnValue({
      authState: { status: "authenticated", user: { nickname: "새 사용자" } },
      beginAuthentication: vi.fn(),
      completeAuthentication: vi.fn(),
      endAuthentication: vi.fn(),
      refreshAuth,
    });
    result.rerender(
      <HomeScheduleDashboardFeature
        nearbyRepository={createRepository()}
        recommendedRepository={recommendedRepository}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );

    await waitFor(() => expect(previousSignal?.aborted).toBe(true));
    fireEvent.click(
      await screen.findByRole("button", { name: "내 할 일에 추가" }),
    );
    await waitFor(() =>
      expect(checklistRepository.addCatalogItemIds).toHaveBeenCalledTimes(2),
    );
    await act(async () => resolvePreviousAddition(["201"]));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "추가됨" })).toBeTruthy();
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
  });

  it("추천 영역 오류만 재시도하고 다른 두 영역 결과를 유지한다", async () => {
    const nearbyRepository = createRepository();
    const unscheduledRepository = createUnscheduledRepository();
    const recommendedRepository = createRecommendedRepository();
    vi.mocked(recommendedRepository.getRecommendedCatalogItems)
      .mockRejectedValueOnce(new Error("서버 내부 메시지"))
      .mockResolvedValueOnce([]);

    render(
      <HomeScheduleDashboardFeature
        nearbyRepository={nearbyRepository}
        recommendedRepository={recommendedRepository}
        unscheduledRepository={unscheduledRepository}
      />,
    );

    expect(
      await screen.findByText("추천 할 일을 불러오지 못했어요"),
    ).toBeTruthy();
    expect(await screen.findByText("예정된 일정이 없어요")).toBeTruthy();
    expect(
      await screen.findByText("일정이 필요한 할 일이 없어요"),
    ).toBeTruthy();
    expect(screen.queryByText("서버 내부 메시지")).toBeNull();
    fireEvent.click(
      within(screen.getByRole("region", { name: "추천 할 일" })).getByRole(
        "button",
        { name: "다시 시도" },
      ),
    );

    expect(await screen.findByText("추천할 일이 없어요")).toBeTruthy();
    expect(nearbyRepository.getNearbyAppointments).toHaveBeenCalledOnce();
    expect(unscheduledRepository.getUnscheduledTasks).toHaveBeenCalledOnce();
    expect(
      recommendedRepository.getRecommendedCatalogItems,
    ).toHaveBeenCalledTimes(2);
  });

  it("다른 두 영역의 실패가 추천 결과를 가리지 않는다", async () => {
    const nearbyRepository = createRepository();
    const unscheduledRepository = createUnscheduledRepository();
    const recommendedRepository = createRecommendedRepository();
    vi.mocked(nearbyRepository.getNearbyAppointments).mockRejectedValue(
      new Error("일정 오류"),
    );
    vi.mocked(unscheduledRepository.getUnscheduledTasks).mockRejectedValue(
      new Error("할 일 오류"),
    );
    vi.mocked(
      recommendedRepository.getRecommendedCatalogItems,
    ).mockResolvedValue([
      {
        category: "스드메",
        catalogItemId: 201,
        phase: 2,
        stepName: "스드메 업체 확정",
        title: "드레스샵 확정",
      },
    ]);

    render(
      <HomeScheduleDashboardFeature
        nearbyRepository={nearbyRepository}
        recommendedRepository={recommendedRepository}
        unscheduledRepository={unscheduledRepository}
      />,
    );

    expect(await screen.findByText("일정을 불러오지 못했어요")).toBeTruthy();
    expect(await screen.findByText("할 일을 불러오지 못했어요")).toBeTruthy();
    expect(await screen.findByText("드레스샵 확정")).toBeTruthy();
  });

  it("추천 인증 오류는 refreshAuth에 연결하고 호출자 취소는 표시하지 않는다", async () => {
    const recommendedRepository = createRecommendedRepository();
    vi.mocked(
      recommendedRepository.getRecommendedCatalogItems,
    ).mockRejectedValue(
      new RecommendedCatalogItemsAuthenticationRequiredError(),
    );
    const { rerender } = render(
      <HomeScheduleDashboardFeature
        nearbyRepository={createRepository()}
        recommendedRepository={recommendedRepository}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );
    await act(async () => undefined);
    expect(refreshAuth).toHaveBeenCalledOnce();
    expect(screen.queryByText("추천 할 일을 불러오지 못했어요")).toBeNull();

    const abortedRepository = createRecommendedRepository();
    vi.mocked(abortedRepository.getRecommendedCatalogItems).mockRejectedValue(
      new RecommendedCatalogItemsRequestAbortedError(),
    );
    rerender(
      <HomeScheduleDashboardFeature
        nearbyRepository={createRepository()}
        recommendedRepository={abortedRepository}
        unscheduledRepository={createUnscheduledRepository()}
      />,
    );
    await act(async () => undefined);
    expect(screen.queryByText("추천 할 일을 불러오지 못했어요")).toBeNull();
  });

  it("추천 요청 unmount와 요청 교체 시 취소하고 늦은 응답을 무시한다", async () => {
    const previous =
      createDeferred<
        Awaited<
          ReturnType<
            RecommendedCatalogItemsRepository["getRecommendedCatalogItems"]
          >
        >
      >();
    const previousRepository = createRecommendedRepository();
    vi.mocked(previousRepository.getRecommendedCatalogItems).mockReturnValue(
      previous.promise,
    );
    const nextRepository = createRecommendedRepository();
    vi.mocked(nextRepository.getRecommendedCatalogItems).mockResolvedValue([
      {
        category: "스드메",
        catalogItemId: 201,
        phase: 2,
        stepName: "스드메 업체 확정",
        title: "새 응답",
      },
    ]);
    const nearbyRepository = createRepository();
    const unscheduledRepository = createUnscheduledRepository();

    const { rerender, unmount } = render(
      <HomeScheduleDashboardFeature
        nearbyRepository={nearbyRepository}
        recommendedRepository={previousRepository}
        unscheduledRepository={unscheduledRepository}
      />,
    );
    const previousSignal = vi.mocked(
      previousRepository.getRecommendedCatalogItems,
    ).mock.calls[0][0];
    expect(previousSignal?.aborted).toBe(false);
    rerender(
      <HomeScheduleDashboardFeature
        nearbyRepository={nearbyRepository}
        recommendedRepository={nextRepository}
        unscheduledRepository={unscheduledRepository}
      />,
    );
    expect(previousSignal?.aborted).toBe(true);
    expect(await screen.findByText("새 응답")).toBeTruthy();
    await act(async () => {
      previous.resolve([
        {
          category: "웨딩홀",
          catalogItemId: 100,
          phase: 1,
          stepName: "웨딩홀 정하기",
          title: "늦은 응답",
        },
      ]);
    });
    expect(screen.queryByText("늦은 응답")).toBeNull();
    const nextSignal = vi.mocked(nextRepository.getRecommendedCatalogItems).mock
      .calls[0][0];
    unmount();
    expect(nextSignal?.aborted).toBe(true);
  });
});
