import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  getSummary: vi.fn(),
}));

vi.mock("./appHeaderDependencies", () => {
  const repository = {
    getSummary: repositoryMocks.getSummary,
  };

  return {
    useAppHeaderSummaryRepository: () => repository,
  };
});

import { AppHeaderSummaryModel } from "./model/appHeaderSummary";
import {
  AppHeaderAuthenticationRequiredError,
  AppHeaderSummaryLoadError,
} from "./repository/appHeaderSummaryRepository";
import { AppHeaderSummaryFeature } from "./AppHeaderSummaryFeature";

const summary: AppHeaderSummaryModel = {
  completedTaskCount: 2,
  totalTaskCount: 3,
  weddingDate: { status: "unset" },
};

beforeEach(() => {
  repositoryMocks.getSummary.mockReset();
});

describe("AppHeaderSummaryFeature", () => {
  it("조회 중에는 결혼 일자 미설정 UI만 표시한다", () => {
    repositoryMocks.getSummary.mockImplementation(
      () => new Promise(() => undefined),
    );
    const { container } = render(
      <AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />,
    );

    expect(screen.getByLabelText("D-Day 미설정")).toBeTruthy();
    expect(screen.getByText("D-Day 미설정")).toBeTruthy();
    expect(screen.getByText("· 결혼 일자 미설정")).toBeTruthy();
    expect(screen.queryByText(/%$/)).toBeNull();
    expect(container.querySelector("time")).toBeNull();
  });

  it("조회 성공 시 실제 완료율과 완료 개수를 표시한다", async () => {
    repositoryMocks.getSummary.mockResolvedValue(summary);
    const { container } = render(
      <AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />,
    );

    expect(await screen.findByText("67%")).toBeTruthy();
    expect(screen.getByText("2/3")).toBeTruthy();
    expect(
      container
        .querySelector(".app-header-summary__progress-range")
        ?.getAttribute("stroke-dasharray"),
    ).toBe("67 33");
  });

  it("빈 체크리스트를 0%와 0/0으로 표시한다", async () => {
    repositoryMocks.getSummary.mockResolvedValue({
      completedTaskCount: 0,
      totalTaskCount: 0,
      weddingDate: { status: "unset" },
    });

    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);

    expect(await screen.findByText("0%")).toBeTruthy();
    expect(screen.getByText("0/0")).toBeTruthy();
  });

  it("일반 실패 시 결혼 일자 미설정 UI를 유지하고 완료율을 숨긴다", async () => {
    repositoryMocks.getSummary.mockRejectedValue(
      new AppHeaderSummaryLoadError(),
    );

    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);

    await waitFor(() =>
      expect(repositoryMocks.getSummary).toHaveBeenCalledOnce(),
    );
    expect(screen.getByLabelText("D-Day 미설정")).toBeTruthy();
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it("인증 만료 시 인증 상태 재확인을 요청한다", async () => {
    const onAuthenticationRequired = vi.fn();
    repositoryMocks.getSummary.mockRejectedValue(
      new AppHeaderAuthenticationRequiredError(),
    );

    render(
      <AppHeaderSummaryFeature
        onAuthenticationRequired={onAuthenticationRequired}
      />,
    );

    await waitFor(() =>
      expect(onAuthenticationRequired).toHaveBeenCalledOnce(),
    );
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it("컴포넌트가 제거되면 진행 중인 요청을 취소한다", () => {
    let requestSignal: AbortSignal | undefined;
    repositoryMocks.getSummary.mockImplementation((signal) => {
      requestSignal = signal;
      return new Promise(() => undefined);
    });
    const { unmount } = render(
      <AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />,
    );

    expect(requestSignal?.aborted).toBe(false);
    unmount();
    expect(requestSignal?.aborted).toBe(true);
  });

  it("StrictMode 재실행 시 이전 요청을 취소하고 최신 결과만 표시한다", async () => {
    const requestSignals: AbortSignal[] = [];
    repositoryMocks.getSummary.mockImplementation((signal) => {
      if (signal) {
        requestSignals.push(signal);
      }

      return requestSignals.length === 1
        ? new Promise(() => undefined)
        : Promise.resolve(summary);
    });

    render(
      <StrictMode>
        <AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />
      </StrictMode>,
    );

    expect(await screen.findByText("67%")).toBeTruthy();
    expect(requestSignals).toHaveLength(2);
    expect(requestSignals[0].aborted).toBe(true);
    expect(requestSignals[1].aborted).toBe(false);
  });
});
