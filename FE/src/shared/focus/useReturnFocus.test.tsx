import { StrictMode, useRef } from "react";
import type { RefObject } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useReturnFocus } from "./useReturnFocus";

function Layer({
  triggerRef,
  fallbackRef,
  mode,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  fallbackRef: RefObject<HTMLButtonElement | null>;
  mode: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useReturnFocus(rootRef, triggerRef, fallbackRef);
  return (
    <div ref={rootRef} data-mode={mode}>
      <input aria-label="작성" />
    </div>
  );
}

function Harness({ open = true, mode = "docked", showTrigger = true }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fallbackRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={fallbackRef}>상단 추가</button>
      {showTrigger && <button ref={triggerRef}>직접 추가</button>}
      <button>다른 선택</button>
      {open && (
        <Layer triggerRef={triggerRef} fallbackRef={fallbackRef} mode={mode} />
      )}
    </>
  );
}

it("StrictMode와 배치 전환 중 입력 초점을 유지하고 닫을 때 한 번 복귀한다", async () => {
  const view = (open: boolean, mode: string) => (
    <StrictMode>
      <Harness open={open} mode={mode} />
    </StrictMode>
  );
  const { rerender } = render(view(true, "docked"));
  const input = screen.getByRole("textbox");
  const trigger = screen.getByText("직접 추가");
  const focus = vi.spyOn(trigger, "focus");
  input.focus();
  rerender(view(true, "overlay"));
  await Promise.resolve();
  expect(document.activeElement).toBe(input);
  rerender(view(false, "overlay"));
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByText("직접 추가")),
  );
  expect(focus).toHaveBeenCalledOnce();
});

it("저장 후 진입 버튼이 사라지면 대체 버튼으로 복귀한다", async () => {
  const { rerender } = render(<Harness />);
  screen.getByRole("textbox").focus();
  rerender(<Harness open={false} showTrigger={false} />);
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByText("상단 추가")),
  );
});

it("다른 컨트롤을 선택해 레이어를 닫으면 그 선택의 초점을 유지한다", async () => {
  const { rerender } = render(<Harness />);
  const next = screen.getByText("다른 선택");
  next.focus();
  rerender(<Harness open={false} />);
  await Promise.resolve();
  expect(document.activeElement).toBe(next);
});
