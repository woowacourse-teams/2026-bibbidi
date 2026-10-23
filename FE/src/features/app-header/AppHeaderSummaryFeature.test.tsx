import { StrictMode } from "react";
import { MemoryRouter } from "react-router";
import { AppHeader } from "../../layouts/AppHeader";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

const summary = {
  categories: [
    { id: "1", title: "웨딩홀", completedTaskCount: 2, totalTaskCount: 3 },
    { id: "2", title: "스드메", completedTaskCount: 0, totalTaskCount: 0 },
  ],
  completedTaskCount: 2,
  totalTaskCount: 3,
};

beforeEach(() => {
  repositoryMocks.checklistRevision = 0;
  repositoryMocks.getSummary.mockReset().mockResolvedValue(summary);
  repositoryMocks.getWeddingDate.mockReset().mockResolvedValue(null);
  repositoryMocks.saveWeddingDate.mockReset();
});

describe("AppHeaderSummaryFeature", () => {
  it("완료율을 열면 실제 순서와 빈 카테고리를 표시하고 재클릭으로 닫는다", async () => {
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);
    const trigger = await screen.findByRole("button", {
      name: /준비 완료율/,
    });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("region", { name: "카테고리별 준비 현황" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(within(dialog).queryByText(/전체|%/)).toBeNull();
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["웨딩홀2/3개 완료", "스드메0/0개 완료"]);
    expect(
      within(dialog)
        .getByRole("progressbar", { name: "웨딩홀 완료율" })
        .getAttribute("aria-valuenow"),
    ).toBe("67");
    expect(
      within(dialog)
        .getByRole("progressbar", { name: "웨딩홀 완료율" })
        .getAttribute("aria-valuetext"),
    ).toBe("2/3개 완료");
    expect(
      within(dialog)
        .getByRole("progressbar", { name: "스드메 완료율" })
        .getAttribute("aria-valuenow"),
    ).toBe("0");
    fireEvent.click(trigger);
    expect(
      screen.queryByRole("region", { name: "카테고리별 준비 현황" }),
    ).toBeNull();
  });

  it("아코디언은 별도 대화상자를 열지 않고 초점을 유지하며 카테고리를 펼친다", async () => {
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);
    const trigger = await screen.findByRole("button", { name: /준비 완료율/ });
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("region", { name: "카테고리별 준비 현황" }),
    ).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByRole("region", { name: "카테고리별 준비 현황" }),
    ).toBeNull();
  });

  it("체크리스트 변경 시 펼친 카테고리와 전체 완료율을 함께 갱신한다", async () => {
    const onAuthenticationRequired = vi.fn();
    const { rerender } = render(
      <AppHeaderSummaryFeature
        onAuthenticationRequired={onAuthenticationRequired}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /준비 완료율/ }));
    repositoryMocks.getSummary.mockResolvedValue({
      ...summary,
      completedTaskCount: 3,
      categories: [
        { ...summary.categories[0], completedTaskCount: 3 },
        summary.categories[1],
      ],
    });
    repositoryMocks.checklistRevision = 1;
    rerender(
      <AppHeaderSummaryFeature
        onAuthenticationRequired={onAuthenticationRequired}
      />,
    );

    const dialog = screen.getByRole("region", { name: "카테고리별 준비 현황" });
    expect(await within(dialog).findByText("3/3개 완료")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /준비 완료율 · 100%/ }),
    ).toBeTruthy();
  });

  it("완료율 재조회 실패 후 복구돼도 아코디언을 자동으로 다시 열지 않는다", async () => {
    const onAuthenticationRequired = vi.fn();
    const { rerender } = render(
      <AppHeaderSummaryFeature
        onAuthenticationRequired={onAuthenticationRequired}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /준비 완료율/ }));
    repositoryMocks.getSummary.mockRejectedValueOnce(
      new AppHeaderSummaryLoadError(),
    );
    repositoryMocks.checklistRevision = 1;
    rerender(
      <AppHeaderSummaryFeature
        onAuthenticationRequired={onAuthenticationRequired}
      />,
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /준비 완료율/ })).toBeNull(),
    );

    repositoryMocks.checklistRevision = 2;
    rerender(
      <AppHeaderSummaryFeature
        onAuthenticationRequired={onAuthenticationRequired}
      />,
    );
    const trigger = await screen.findByRole("button", {
      name: /준비 완료율/,
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByRole("region", { name: "카테고리별 준비 현황" }),
    ).toBeNull();
  });

  it("날짜 팝오버와 완료율 아코디언를 한 번에 하나만 연다", async () => {
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);
    const progress = await screen.findByRole("button", {
      name: /준비 완료율/,
    });
    const weddingDate = await screen.findByRole("button", {
      name: /결혼 예정일 설정/,
    });
    fireEvent.click(progress);
    fireEvent.click(weddingDate);
    expect(
      screen.getByRole("dialog", { name: "결혼 예정일 설정" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "카테고리별 준비 현황" }),
    ).toBeNull();
    fireEvent.click(progress);
    expect(
      screen.getByRole("region", { name: "카테고리별 준비 현황" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("dialog", { name: "결혼 예정일 설정" }),
    ).toBeNull();
  });

  it("결혼 일자 미설정 안내를 브랜드 색상 상태로 표시한다", async () => {
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);

    const trigger = await screen.findByRole("button", {
      name: /D-Day, 결혼 일자 미설정\. 결혼 예정일 설정/,
    });

    expect(trigger.getAttribute("data-color")).toBe("primary");
    expect(trigger.getAttribute("data-variant")).toBe("weak");
    expect(
      screen.getByRole("button", { name: /결혼 예정일 설정/ }).textContent,
    ).toContain("결혼 일자 미설정");
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

    expect(await screen.findByText("준비 완료율 · 67%")).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: /결혼 예정일 설정/ }),
    ).toBeTruthy();
    expect(
      screen.getByText("2/3개 완료", {
        selector: ".bibbidi-accordion-description",
      }),
    ).toBeTruthy();
  });

  it("결혼 예정일 조회 실패와 완료율 성공을 독립적으로 표시하고 날짜만 재시도한다", async () => {
    repositoryMocks.getWeddingDate
      .mockRejectedValueOnce(new WeddingDateLoadError())
      .mockResolvedValueOnce("2027-05-15");
    render(<AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />);

    expect(await screen.findByText("준비 완료율 · 67%")).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "2027년 5월" }));
    fireEvent.change(screen.getByRole("listbox", { name: "연도" }), {
      target: { value: "2028" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "날짜 선택으로 돌아가기" }),
    );
    fireEvent.click(screen.getByRole("gridcell", { name: /2028년 5월 16일/ }));
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
    fireEvent.click(screen.getByRole("gridcell", { name: /2027년 5월 20일/ }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(trigger);

    expect(
      screen
        .getByRole("gridcell", { name: /2027년 5월 15일/ })
        .getAttribute("aria-selected"),
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
    fireEvent.click(screen.getByRole("gridcell", { name: /20일/ }));
    const saveButton = screen.getByRole("button", { name: "저장" });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    expect(repositoryMocks.saveWeddingDate).toHaveBeenCalledOnce();

    rejectSave?.(new WeddingDateSaveError());
    expect((await screen.findByRole("alert")).textContent).toContain(
      "다시 시도",
    );
    expect(
      screen
        .getByRole("gridcell", { name: /20일/ })
        .getAttribute("aria-selected"),
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
    fireEvent.click(screen.getAllByRole("gridcell", { name: /일/ }).at(-1)!);
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

    expect(await screen.findByText("준비 완료율 · 67%")).toBeTruthy();
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

function renderAccountSummary() {
  return render(
    <MemoryRouter>
      <AppHeader
        user={{
          kind: "authenticated",
          isLoggingOut: false,
          logoutErrorMessage: null,
          onLogout: vi.fn(),
          summary: (
            <AppHeaderSummaryFeature onAuthenticationRequired={vi.fn()} />
          ),
          userInitial: "비",
        }}
      />
    </MemoryRouter>,
  );
}

describe("계정 패널 안의 준비 현황", () => {
  it("예정일 팝업에서 Escape를 누르면 팝업만 닫고 계정 패널을 유지한다", async () => {
    repositoryMocks.getWeddingDate.mockResolvedValue("2027-05-15");
    renderAccountSummary();
    const accountTrigger = screen.getByRole("button", { name: "계정 메뉴" });
    fireEvent.click(accountTrigger);
    const dateTrigger = await screen.findByRole("button", {
      name: /결혼 예정일 설정/,
    });
    fireEvent.click(dateTrigger);
    const day = screen.getByRole("gridcell", { name: /2027년 5월 15일/ });
    fireEvent.keyDown(day, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "결혼 예정일 설정" }),
    ).toBeNull();
    expect(screen.getByRole("dialog", { name: "계정 메뉴" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(dateTrigger));
    fireEvent.keyDown(dateTrigger, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "계정 메뉴" })).toBeNull();
    expect(document.activeElement).toBe(accountTrigger);
  });

  it("완료율은 계정 패널 안에서 펼쳐지고 바깥 클릭으로 계정 패널을 닫는다", async () => {
    renderAccountSummary();
    fireEvent.click(screen.getByRole("button", { name: "계정 메뉴" }));
    fireEvent.click(await screen.findByRole("button", { name: /준비 완료율/ }));
    const account = screen.getByRole("dialog", { name: "계정 메뉴" });
    expect(
      within(account).getByRole("region", { name: "카테고리별 준비 현황" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "계정 메뉴" })).toBeNull();
  });

  it("날짜 저장 중 바깥 클릭으로 닫지 않고 실패 후 입력을 유지해 재시도한다", async () => {
    repositoryMocks.getWeddingDate.mockResolvedValue("2027-05-15");
    let rejectSave!: (reason: unknown) => void;
    repositoryMocks.saveWeddingDate.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectSave = reject;
        }),
    );
    renderAccountSummary();
    fireEvent.click(screen.getByRole("button", { name: "계정 메뉴" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /결혼 예정일 설정/ }),
    );
    fireEvent.click(screen.getByRole("gridcell", { name: /2027년 5월 20일/ }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    fireEvent.pointerDown(document.body);
    expect(
      screen.getByRole("dialog", { name: "결혼 예정일 설정" }),
    ).toBeTruthy();
    rejectSave(new WeddingDateSaveError());
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen
        .getByRole("gridcell", { name: /2027년 5월 20일/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
    repositoryMocks.saveWeddingDate.mockResolvedValueOnce("2027-05-20");
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "결혼 예정일 설정" }),
      ).toBeNull(),
    );
    expect(screen.getByRole("dialog", { name: "계정 메뉴" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /2027년 5월 20일. 결혼 예정일 설정/ }),
    ).toBeTruthy();
  });
});

describe("화면 이동 시 준비 현황 유지", () => {
  it.each(["예정일", "완료율"])(
    "%s 상세를 닫고 데이터를 재조회하지 않는다",
    async (popup) => {
      repositoryMocks.getWeddingDate.mockResolvedValue("2027-05-15");
      const onAuthenticationRequired = vi.fn();
      const { rerender } = render(
        <AppHeaderSummaryFeature
          navigationKey="/checklist"
          onAuthenticationRequired={onAuthenticationRequired}
        />,
      );
      const dateTrigger = await screen.findByRole("button", {
        name: /결혼 예정일 설정/,
      });
      const progressTrigger = await screen.findByRole("button", {
        name: /준비 완료율/,
      });
      fireEvent.click(popup === "예정일" ? dateTrigger : progressTrigger);
      expect(
        popup === "예정일"
          ? screen.getByRole("dialog")
          : screen.getByRole("region", { name: "카테고리별 준비 현황" }),
      ).toBeTruthy();
      rerender(
        <AppHeaderSummaryFeature
          navigationKey="/calendar"
          onAuthenticationRequired={onAuthenticationRequired}
        />,
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(
        screen.queryByRole("region", { name: "카테고리별 준비 현황" }),
      ).toBeNull();
      expect(
        screen.getByRole("button", {
          name: /2027년 5월 15일. 결혼 예정일 설정/,
        }),
      ).toBeTruthy();
      expect(repositoryMocks.getWeddingDate).toHaveBeenCalledOnce();
      expect(repositoryMocks.getSummary).toHaveBeenCalledOnce();
    },
  );
});
