import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../auth";
import { HomeScheduleDashboardFeature } from "./HomeScheduleDashboardFeature";
import {
  NearbyAppointmentsAuthenticationRequiredError,
  NearbyAppointmentsRepository,
} from "./repository/nearbyAppointmentsRepository";

vi.mock("../auth", () => ({
  useAuth: vi.fn(),
}));

const refreshAuth = vi.fn();

function createRepository(): NearbyAppointmentsRepository {
  return {
    getNearbyAppointments: vi.fn().mockResolvedValue([]),
  };
}

beforeEach(() => {
  refreshAuth.mockReset();
  vi.mocked(useAuth).mockReturnValue({
    authState: { status: "authenticated", user: { nickname: "비비디" } },
    beginAuthentication: vi.fn(),
    completeAuthentication: vi.fn(),
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
    vi.mocked(repository.getNearbyAppointments).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(
      <HomeScheduleDashboardFeature
        getReferenceDate={() => "2026-09-16"}
        repository={repository}
      />,
    );

    expect(screen.getByText("가까운 일정을 불러오는 중입니다.")).toBeTruthy();

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
    expect(within(upcomingSection).getByText("2개")).toBeTruthy();
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
    expect(
      screen.getByRole("heading", { name: "추가하면 좋은 일정" }),
    ).toBeTruthy();
  });

  it("빈 응답을 Empty UI로 전환한다", async () => {
    render(
      <HomeScheduleDashboardFeature
        getReferenceDate={() => "2026-09-16"}
        repository={createRepository()}
      />,
    );

    expect(await screen.findByText("예정된 일정이 없어요")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "가까운 일정" })).getByText(
        "0개",
      ),
    ).toBeTruthy();
  });

  it("오류를 Error UI로 전환하고 다시 시도한다", async () => {
    const repository = createRepository();
    vi.mocked(repository.getNearbyAppointments)
      .mockRejectedValueOnce(new Error("서버 내부 메시지"))
      .mockResolvedValueOnce([]);

    render(
      <HomeScheduleDashboardFeature
        getReferenceDate={() => "2026-09-16"}
        repository={repository}
      />,
    );

    expect(await screen.findByText("일정을 불러오지 못했어요")).toBeTruthy();
    expect(screen.queryByText("서버 내부 메시지")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("예정된 일정이 없어요")).toBeTruthy();
    expect(repository.getNearbyAppointments).toHaveBeenCalledTimes(2);
  });

  it("인증 오류에서 refreshAuth를 호출한다", async () => {
    const repository = createRepository();
    vi.mocked(repository.getNearbyAppointments).mockRejectedValue(
      new NearbyAppointmentsAuthenticationRequiredError(),
    );

    render(
      <HomeScheduleDashboardFeature
        getReferenceDate={() => "2026-09-16"}
        repository={repository}
      />,
    );

    await act(async () => undefined);

    expect(refreshAuth).toHaveBeenCalledOnce();
    expect(screen.queryByText("일정을 불러오지 못했어요")).toBeNull();
  });

  it("unmount 시 진행 중인 요청을 취소한다", () => {
    const repository = createRepository();
    vi.mocked(repository.getNearbyAppointments).mockReturnValue(
      new Promise(() => undefined),
    );
    const { unmount } = render(
      <HomeScheduleDashboardFeature repository={repository} />,
    );
    const signal = vi.mocked(repository.getNearbyAppointments).mock.calls[0][0];

    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
