import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Tab } from "./Tab";

afterEach(() => vi.unstubAllGlobals());

it("화면 재렌더링은 수동 스크롤을 유지하고 선택 변경만 선택 탭을 드러낸다", () => {
  const observers: {
    notify: () => void;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn();
      constructor(callback: () => void) {
        observers.push({ notify: callback, disconnect: this.disconnect });
      }
      observe() {}
    },
  );
  const page = (selected: number, title = "웨딩홀", extra = false) => (
    <Tab onChange={() => {}} fluid ariaLabel="카테고리">
      <Tab.Item key="venue" selected={selected === 0}>
        {title}
      </Tab.Item>
      <Tab.Item key="studio" selected={selected === 1}>
        스드메
      </Tab.Item>
      {extra && (
        <Tab.Item key="travel" selected={selected === 2}>
          신혼여행
        </Tab.Item>
      )}
    </Tab>
  );
  const { rerender, unmount } = render(page(0));
  const root = screen.getByRole("tablist");
  const [venue, studio] = screen.getAllByRole("tab");
  const track = venue.parentElement!;
  Object.defineProperty(root, "clientWidth", {
    configurable: true,
    value: 100,
  });
  Object.defineProperty(venue, "offsetWidth", {
    configurable: true,
    value: 60,
  });
  Object.defineProperty(studio, "offsetLeft", {
    configurable: true,
    value: 160,
  });
  Object.defineProperty(studio, "offsetWidth", {
    configurable: true,
    value: 80,
  });
  root.scrollLeft = 60;
  rerender(page(0, "웨딩홀 준비"));
  expect(root.scrollLeft).toBe(60);
  expect(observers).toHaveLength(1);
  expect(observers[0].disconnect).not.toHaveBeenCalled();
  act(() => observers[0].notify());
  expect(track.style.getPropertyValue("--tab-indicator-width")).toBe("60px");
  expect(root.scrollLeft).toBe(60);
  rerender(page(1));
  expect(root.scrollLeft).toBe(140);
  expect(track.style.getPropertyValue("--tab-indicator-left")).toBe("160px");
  expect(observers).toHaveLength(1);
  Object.defineProperty(studio, "offsetWidth", {
    configurable: true,
    value: 100,
  });
  act(() => observers[0].notify());
  expect(track.style.getPropertyValue("--tab-indicator-width")).toBe("100px");
  expect(root.scrollLeft).toBe(140);
  rerender(page(1, "웨딩홀", true));
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
  expect(observers).toHaveLength(2);
  unmount();
  expect(observers[1].disconnect).toHaveBeenCalledOnce();
});
