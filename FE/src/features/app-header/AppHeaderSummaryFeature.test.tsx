import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  checklistRevision: 0,
  getSummary: vi.fn(),
  getWeddingDate: vi.fn(),
  saveWeddingDate: vi.fn(),
}));

vi.mock("./appHeaderDependencies", () => {
  const summaryRepository = { getSummary: repositoryMocks.getSummary };
  const weddingDateRepository = {
    getWeddingDate: repositoryMocks.getWeddingDate,
    saveWeddingDate: repositoryMocks.saveWeddingDate,
  };

  return {
    useAppHeaderChecklistRevision: () => repositoryMocks.checklistRevision,
    useAppHeaderSummaryRepository: () => summaryRepository,
    useWeddingDateRepository: () => weddingDateRepository,
  };
});

import {
  AppHeaderAuthenticationRequiredError,
  AppHeaderSummaryLoadError,
} from "./repository/appHeaderSummaryRepository";
import {
  WeddingDateAuthenticationRequiredError,
  WeddingDateLoadError,
  WeddingDateRequestAbortedError,
  WeddingDateSaveError,
} from "./repository/weddingDateRepository";
import { AppHeaderSummaryFeature } from "./AppHeaderSummaryFeature";

const summary = { completedTaskCount: 2, totalTaskCount: 3 };

beforeEach(() => {
  repositoryMocks.checklistRevision = 0;
  repositoryMocks.getSummary.mockReset().mockResolvedValue(summary);
  repositoryMocks.getWeddingDate.mockReset().mockResolvedValue(null);
  repositoryMocks.saveWeddingDate.mockReset();
});

describe("AppHeaderSummaryFeature", () => {
  it("결혼 일자 미설정 안내를 브랜드 색상 상태로 표시한다", async () => {
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);

    const trigger = await screen.findByRole("button", {
      name: /D-Day, 결혼 일자 미설정\. 결혼 예정일 설정/,
    });

    expect(trigger.classList).toContain(
      "app-header-summary__d-day-button--unset",
    );
    expect(screen.getByText("D-Day 미설정")).toBeTruthy();
  });

  it("두 조회가 진행 중일 때 결혼 예정일 로딩을 표시하고 완료율을 숨긴다", () => {
    repositoryMocks.getSummary.mockImplementation(
      () => new Promise(() => undefined),
    );
    repositoryMocks.getWeddingDate.mockImplementation(
      () => new Promise(() => undefined),
    );
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);

    expect(
      screen.getByRole("status", { name: "결혼 예정일 조회 중" }),
    ).toBeTruthy();
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it("결혼 예정일과 완료율 결과를 함께 표시한다", async () => {
    repositoryMocks.getWeddingDate.mockResolvedValue("2027-05-15");
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);

    expect(await screen.findByText("67%")).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: /결혼 예정일 설정/ }),
    ).toBeTruthy();
    expect(screen.getByText("2/3")).toBeTruthy();
  });

  it("결혼 예정일 조회 실패와 완료율 성공을 독립적으로 표시하고 날짜만 재시도한다", async () => {
    repositoryMocks.getWeddingDate
      .mockRejectedValueOnce(new WeddingDateLoadError())
      .mockResolvedValueOnce("2027-05-15");
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);

    expect(await screen.findByText("67%")).toBeTruthy();
    expect(
      await screen.findByRole("status", { name: "결혼 예정일 조회 실패" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "결혼 예정일 조회 다시 시도" }),
    );

    expect(
      await screen.findByRole("button", { name: /결혼 예정일 설정/ }),
    ).toBeTruthy();
    expect(repositoryMocks.getWeddingDate).toHaveBeenCalledTimes(2);
    expect(repositoryMocks.getSummary).toHaveBeenCalledOnce();
  });

  it("완료율 조회 실패가 결혼 예정일 정상 결과를 가리지 않는다", async () => {
    repositoryMocks.getSummary.mockRejectedValue(
      new AppHeaderSummaryLoadError(),
    );
    repositoryMocks.getWeddingDate.mockResolvedValue("2027-05-15");
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);

    expect(
      await screen.findByRole("button", { name: /2027년 5월 15일/ }),
    ).toBeTruthy();
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it.each([
    new AppHeaderAuthenticationRequiredError(),
    new WeddingDateAuthenticationRequiredError(),
  ])("401 의미 오류에서 인증 상태 재확인을 요청한다", async (error) => {
    const onAuthenticationRequired = vi.fn();
    if (error instanceof AppHeaderAuthenticationRequiredError) {
      repositoryMocks.getSummary.mockRejectedValue(error);
    } else {
      repositoryMocks.getWeddingDate.mockRejectedValue(error);
    }
    render(
      <AppHeaderSummaryFeature
        onAuthenticationRequired={onAuthenticationRequired}
      />,
    );
    await waitFor(() =>
      expect(onAuthenticationRequired).toHaveBeenCalledOnce(),
    );
  });

  it("저장 성공 시 팝오버를 닫고 헤더를 즉시 갱신한다", async () => {
    repositoryMocks.getWeddingDate.mockResolvedValue("2027-05-15");
    repositoryMocks.saveWeddingDate.mockResolvedValue("2028-06-16");
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /결혼 예정일 설정/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "다음 연도" }));
    fireEvent.click(screen.getByRole("button", { name: "2028년 5월 16일" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(
      await screen.findByRole("button", { name: /2028년 6월 16일/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(repositoryMocks.saveWeddingDate).toHaveBeenCalledWith(
      "2028-05-16",
      expect.any(AbortSignal),
    );
    expect(repositoryMocks.getWeddingDate).toHaveBeenCalledOnce();
  });

  it("선택 후 취소하면 저장하지 않고 다시 열었을 때 서버 날짜를 유지한다", async () => {
    repositoryMocks.getWeddingDate.mockResolvedValue("2027-05-15");
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);

    const trigger = await screen.findByRole("button", {
      name: /결혼 예정일 설정/,
    });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "2027년 5월 20일" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(trigger);

    expect(
      screen
        .getByRole("button", { name: "2027년 5월 15일" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(repositoryMocks.saveWeddingDate).not.toHaveBeenCalled();
  });

  it("저장 중 중복 제출을 막고 실패 시 선택과 팝오버를 유지해 재시도한다", async () => {
    let rejectSave: ((error: Error) => void) | undefined;
    repositoryMocks.saveWeddingDate
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectSave = reject;
          }),
      )
      .mockResolvedValueOnce("2027-05-20");
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /결혼 예정일 설정/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /20일/ }));
    const saveButton = screen.getByRole("button", { name: "저장" });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    expect(repositoryMocks.saveWeddingDate).toHaveBeenCalledOnce();

    rejectSave?.(new WeddingDateSaveError());
    expect((await screen.findByRole("alert")).textContent).toContain(
      "다시 시도",
    );
    expect(
      screen.getByRole("button", { name: /20일/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(repositoryMocks.saveWeddingDate).toHaveBeenCalledTimes(2),
    );
  });

  it("컴포넌트 제거 시 완료율, 날짜 조회와 저장 요청을 모두 취소한다", async () => {
    const signals: AbortSignal[] = [];
    repositoryMocks.getSummary.mockImplementation((signal) => {
      signals.push(signal);
      return new Promise(() => undefined);
    });
    repositoryMocks.getWeddingDate.mockImplementation((signal) => {
      signals.push(signal);
      return Promise.resolve(null);
    });
    repositoryMocks.saveWeddingDate.mockImplementation((_date, signal) => {
      signals.push(signal);
      return new Promise(() => undefined);
    });
    const { unmount } = render(
      <AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /결혼 예정일 설정/ }),
    );
    fireEvent.click(screen.getAllByRole("button", { name: /일/ }).at(-1)!);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    unmount();
    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("StrictMode 재실행에서 이전 독립 요청을 취소한다", async () => {
    const summarySignals: AbortSignal[] = [];
    const dateSignals: AbortSignal[] = [];
    repositoryMocks.getSummary.mockImplementation((signal) => {
      summarySignals.push(signal);
      return summarySignals.length === 1
        ? new Promise(() => undefined)
        : Promise.resolve(summary);
    });
    repositoryMocks.getWeddingDate.mockImplementation((signal) => {
      dateSignals.push(signal);
      return dateSignals.length === 1
        ? new Promise(() => undefined)
        : Promise.resolve(null);
    });
    render(
      <StrictMode>
        <AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />
      </StrictMode>,
    );

    expect(await screen.findByText("67%")).toBeTruthy();
    expect(summarySignals[0].aborted).toBe(true);
    expect(dateSignals[0].aborted).toBe(true);
  });

  it("취소 오류는 사용자 오류로 표시하지 않는다", async () => {
    repositoryMocks.getWeddingDate.mockRejectedValue(
      new WeddingDateRequestAbortedError(),
    );
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);
    await waitFor(() =>
      expect(repositoryMocks.getWeddingDate).toHaveBeenCalledOnce(),
    );
    expect(screen.queryByText("결혼 예정일 조회 실패")).toBeNull();
  });
});
