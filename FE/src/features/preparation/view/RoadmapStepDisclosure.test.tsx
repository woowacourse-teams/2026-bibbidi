import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoadmapStepDisclosure } from "./RoadmapStepDisclosure";

afterEach(() => vi.useRealTimers());

describe("RoadmapStepDisclosure", () => {
  it("접는 동안 기존 내용을 유지하되 키보드와 보조 기술에서 숨긴다", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <RoadmapStepDisclosure expanded>
        <button>웨딩홀 할 일 추가</button>
      </RoadmapStepDisclosure>,
    );

    rerender(
      <RoadmapStepDisclosure expanded={false}>{null}</RoadmapStepDisclosure>,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("웨딩홀 할 일 추가")).toBeTruthy();
    expect(container.firstElementChild?.hasAttribute("inert")).toBe(true);

    act(() => vi.runOnlyPendingTimers());
    expect(screen.queryByText("웨딩홀 할 일 추가")).toBeNull();
  });

  it("접는 중 다시 펼치면 이전 정리 작업을 취소하고 최신 내용을 유지한다", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <RoadmapStepDisclosure expanded>
        <button>웨딩홀 할 일 추가</button>
      </RoadmapStepDisclosure>,
    );
    rerender(
      <RoadmapStepDisclosure expanded={false}>{null}</RoadmapStepDisclosure>,
    );
    act(() => vi.advanceTimersByTime(100));

    rerender(
      <RoadmapStepDisclosure expanded>
        <button>변경된 할 일 추가</button>
      </RoadmapStepDisclosure>,
    );
    act(() => vi.runOnlyPendingTimers());

    expect(
      screen.getByRole("button", { name: "변경된 할 일 추가" }),
    ).toBeTruthy();
    expect(screen.queryByText("웨딩홀 할 일 추가")).toBeNull();
  });

  it("접기 중 다른 단계를 선택해도 닫히는 상세를 새 단계 내용으로 바꾸지 않는다", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <RoadmapStepDisclosure expanded>
        <span>기존 단계 내용</span>
      </RoadmapStepDisclosure>,
    );

    rerender(
      <RoadmapStepDisclosure expanded={false}>
        <span>다른 단계 내용</span>
      </RoadmapStepDisclosure>,
    );

    expect(screen.getByText("기존 단계 내용")).toBeTruthy();
    expect(screen.queryByText("다른 단계 내용")).toBeNull();
    act(() => vi.runOnlyPendingTimers());
    expect(screen.queryByText("기존 단계 내용")).toBeNull();
  });
});
