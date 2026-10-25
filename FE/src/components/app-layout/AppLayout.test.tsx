import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppLayout } from "./AppLayout";
import type {
  AppLayoutHeaderPosition,
  AppLayoutHeaderTone,
  AppLayoutScroll,
} from "./AppLayout";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("헤더의 실제 높이를 추적하고 설정 변경 중 입력값과 스크롤 ref를 유지한다", () => {
  let height = 96;
  const callbacks: ResizeObserverCallback[] = [];
  const disconnect = vi.fn();
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
  const bounds = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains("bibbidi-app-layout-header")
        ? { ...bounds.call(this), height }
        : bounds.call(this);
    },
  );
  const ref = createRef<HTMLDivElement>();
  const onScroll = vi.fn();
  const view = (
    position: AppLayoutHeaderPosition = "sticky",
    tone: AppLayoutHeaderTone = "fade",
    scroll: AppLayoutScroll = "contained",
  ) => (
    <AppLayout
      ref={ref}
      header={<header>헤더</header>}
      headerPosition={position}
      headerTone={tone}
      scroll={scroll}
      onScroll={onScroll}
      data-modal-scope
    >
      <main>
        <input aria-label="메모" defaultValue="" />
      </main>
    </AppLayout>
  );
  const { rerender } = render(view());
  const root = ref.current!;
  expect(root.style.getPropertyValue("--app-layout-header-height")).toBe(
    "96px",
  );
  height = 144;
  act(() => callbacks[0]([], {} as ResizeObserver));
  expect(root.style.getPropertyValue("--app-layout-header-height")).toBe(
    "144px",
  );

  const input = screen.getByRole("textbox", { name: "메모" });
  fireEvent.change(input, { target: { value: "작성 중" } });
  root.scrollTop = 200;
  rerender(view("sticky", "solid", "document"));
  expect(ref.current).toBe(root);
  expect(screen.getByRole("textbox", { name: "메모" })).toBe(input);
  expect((input as HTMLInputElement).value).toBe("작성 중");
  expect(root.scrollTop).toBe(200);
  expect(root.querySelector("header")?.parentElement?.parentElement).toBe(root);
  fireEvent.scroll(root);
  expect(onScroll).toHaveBeenCalledOnce();

  rerender(view("static"));
  expect(disconnect).toHaveBeenCalledOnce();
  expect(root.style.getPropertyValue("--app-layout-header-height")).toBe("");
});
