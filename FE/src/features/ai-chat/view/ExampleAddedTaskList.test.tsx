import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCallback, useState } from "react";
import type { ComponentProps } from "react";

import { recommendedTasks } from "../model/exampleChat";
import { ExampleAddedTaskList as ExampleAddedTaskListView } from "./ExampleAddedTaskList";

function ExampleAddedTaskList(
  props: Omit<
    ComponentProps<typeof ExampleAddedTaskListView>,
    "completedCount" | "onTaskComplete"
  >,
) {
  const [completedCount, setCompletedCount] = useState(0);
  const onTaskComplete = useCallback(
    () => setCompletedCount((count) => count + 1),
    [],
  );
  return (
    <ExampleAddedTaskListView
      {...props}
      completedCount={completedCount}
      onTaskComplete={onTaskComplete}
    />
  );
}

const scrollIntoView = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  scrollIntoView.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

const props = {
  tasks: recommendedTasks,
  visibleCount: 2,
  focusRequest: 1,
  isPaused: false,
};
const tick = (milliseconds: number) =>
  act(() => vi.advanceTimersByTime(milliseconds));
const title = (index: number) =>
  within(screen.getAllByRole("listitem")[index]).getByText(
    (_text, element) => element?.className === "ai-task-preview__title",
  );

describe("추천 할 일 추가 애니메이션", () => {
  it("리스트로 이동해 첫 글자부터 보여주고 선택 순서대로 항목을 완성한다", () => {
    render(<ExampleAddedTaskList {...props} />);
    expect(document.activeElement).toBe(screen.getAllByRole("listitem")[0]);
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" }),
    );
    expect(title(0).textContent).toBe("");
    expect(title(1).textContent).toBe("추가 대기 중");
    tick(280);
    expect(title(0).textContent).toBe("주");
    tick(1000);
    expect(title(0).textContent).toBe(recommendedTasks[0].title);
    expect(title(1).textContent).toBe("");
    tick(280);
    expect(title(1).textContent).toBe("사");
    tick(1000);
    expect(title(1).textContent).toBe(recommendedTasks[1].title);
    expect(screen.getByRole("status").textContent).toContain(
      recommendedTasks[1].title,
    );
    expect(document.querySelector(".ai-task-preview__cursor")).toBeNull();
  });

  it("재확인과 목록 갱신은 완성한 항목을 다시 타이핑하지 않는다", () => {
    const { rerender } = render(
      <ExampleAddedTaskList {...props} visibleCount={1} />,
    );
    tick(1300);
    rerender(
      <ExampleAddedTaskList {...props} visibleCount={1} focusRequest={2} />,
    );
    expect(title(0).textContent).toBe(recommendedTasks[0].title);
    expect(document.querySelector(".ai-task-preview__cursor")).toBeNull();
    rerender(<ExampleAddedTaskList {...props} focusRequest={3} />);
    expect(title(0).textContent).toBe(recommendedTasks[0].title);
    expect(title(1).textContent).toBe("");
    tick(280);
    expect(title(1).textContent).toBe("사");
  });

  it("채팅을 다시 열면 타이핑을 멈추고 닫으면 이어 쓰며 포커스를 빼앗지 않는다", () => {
    const { rerender } = render(<ExampleAddedTaskList {...props} />);
    tick(400);
    const partialTitle = title(0).textContent;
    rerender(<ExampleAddedTaskList {...props} isPaused />);
    const chatInput = document.createElement("input");
    document.body.append(chatInput);
    chatInput.focus();
    tick(2000);
    expect(title(0).textContent).toBe(partialTitle);
    rerender(<ExampleAddedTaskList {...props} />);
    tick(36);
    expect(title(0).textContent!.length).toBe(partialTitle!.length + 1);
    expect(document.activeElement).toBe(chatInput);
    chatInput.remove();
  });

  it("모션 감소 설정에서는 완성된 글자를 즉시 표시하고 부드러운 이동을 생략한다", () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    render(<ExampleAddedTaskList {...props} />);
    expect(title(0).textContent).toBe(recommendedTasks[0].title);
    expect(title(1).textContent).toBe(recommendedTasks[1].title);
    expect(document.querySelector(".ai-task-preview__cursor")).toBeNull();
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "auto" }),
    );
  });

  it("미확인 항목은 노출·재생하지 않고 화면을 떠나면 타이머를 정리한다", () => {
    const { rerender, unmount } = render(
      <ExampleAddedTaskList {...props} visibleCount={0} />,
    );
    tick(2000);
    expect(screen.queryByRole("list")).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
    rerender(<ExampleAddedTaskList {...props} />);
    tick(280);
    expect(title(0).textContent).toBe("주");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
