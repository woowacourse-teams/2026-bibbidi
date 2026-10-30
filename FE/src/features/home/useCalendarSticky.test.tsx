import { act, fireEvent, render, screen } from "@testing-library/react";
import type { CSSProperties } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useCalendarSticky } from "./useCalendarSticky";

function Harness({ enabled = true, top = 120 }) {
  const { wrapperRef, calendarRef } = useCalendarSticky();
  return (
    <div data-page-scroll-container>
      <div
        ref={wrapperRef}
        style={
          {
            "--calendar-sticky-enabled": enabled ? "1" : "0",
            "--calendar-bottom-gap": "24px",
            top: `${top}px`,
          } as CSSProperties
        }
      >
        <section ref={calendarRef} aria-label="달력">
          <input aria-label="선택 유지" defaultValue="선택한 날짜" />
        </section>
      </div>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("실제 높이가 들어올 때만 고정하고 낮은 창·확대·1열 전환에서도 내용을 보존한다", () => {
  let viewportHeight = 900;
  vi.stubGlobal("innerHeight", viewportHeight);
  let regularHeight = 668;
  let compactHeight = 552;
  const callbacks: ResizeObserverCallback[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const disconnect = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    () => viewportHeight,
  );
  const bounds = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return this.tagName === "SECTION"
        ? {
            ...bounds.call(this),
            height:
              this.dataset.density === "compact"
                ? compactHeight
                : regularHeight,
          }
        : bounds.call(this);
    },
  );
  const measure = () =>
    act(() => {
      vi.stubGlobal("innerHeight", viewportHeight);
      callbacks[0]([], {} as ResizeObserver);
      const queued = [...frames.values()];
      frames.clear();
      queued.forEach((callback) => callback(0));
    });
  const { rerender, unmount } = render(<Harness />);
  const input = screen.getByRole("textbox");
  const calendar = input.parentElement!;
  const wrapper = calendar.parentElement!;
  fireEvent.change(input, { target: { value: "2026-11-12" } });
  expect(wrapper.dataset.calendarSticky).toBe("true");
  expect(calendar.dataset.density).toBeUndefined();

  viewportHeight = 720;
  measure();
  expect(wrapper.dataset.calendarSticky).toBe("true");
  expect(calendar.dataset.density).toBe("compact");

  viewportHeight = 600;
  measure();
  expect(wrapper.dataset.calendarSticky).toBeUndefined();
  expect(calendar.dataset.density).toBe("compact");

  viewportHeight = 720;
  measure();
  expect(wrapper.dataset.calendarSticky).toBe("true");
  // Increased text or schedule content must not be clipped by sticky positioning.
  regularHeight = 900;
  compactHeight = 800;
  measure();
  expect(wrapper.dataset.calendarSticky).toBeUndefined();

  rerender(<Harness enabled={false} />);
  measure();
  expect(calendar.dataset.density).toBeUndefined();
  expect(wrapper.dataset.calendarSticky).toBeUndefined();
  expect(screen.getByRole("textbox")).toBe(input);
  expect((input as HTMLInputElement).value).toBe("2026-11-12");

  regularHeight = 668;
  compactHeight = 552;
  viewportHeight = 900;
  rerender(<Harness top={320} />);
  measure();
  expect(wrapper.dataset.calendarSticky).toBe("true");
  expect(calendar.dataset.density).toBe("compact");
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
});
