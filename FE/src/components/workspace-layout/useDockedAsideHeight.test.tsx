import { useRef } from "react";
import type { CSSProperties } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDockedAsideHeight } from "./useDockedAsideHeight";

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  useDockedAsideHeight(ref, true);
  return (
    <div
      data-page-scroll-container
      style={{ "--app-layout-header-height": "96px" } as CSSProperties}
    >
      <div>
        <div
          ref={ref}
          data-testid="aside"
          style={
            { "--layout-gutter-desktop": "24px", top: "120px" } as CSSProperties
          }
        />
      </div>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("본문을 스크롤해도 헤더 아래에서 패널 높이를 계산하고 헤더 크기 변경을 반영한다", async () => {
  vi.stubGlobal("innerHeight", 800);
  let top = 120;
  const bounds = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const rect = bounds.call(this);
      return this.dataset.testid === "aside" ? { ...rect, top } : rect;
    },
  );
  const { container, getByTestId, unmount } = render(<Harness />);
  const scroll = container.querySelector<HTMLElement>(
    "[data-page-scroll-container]",
  )!;
  const aside = getByTestId("aside");
  expect(aside.style.getPropertyValue("--workspace-aside-height")).toBe(
    "656px",
  );

  top = 184;
  aside.style.top = "184px";
  scroll.style.setProperty("--app-layout-header-height", "160px");
  await waitFor(() =>
    expect(aside.style.getPropertyValue("--workspace-aside-height")).toBe(
      "592px",
    ),
  );

  top = 260;
  fireEvent.scroll(scroll);
  expect(aside.style.getPropertyValue("--workspace-aside-height")).toBe(
    "516px",
  );
  top = -100;
  fireEvent.scroll(scroll);
  expect(aside.style.getPropertyValue("--workspace-aside-height")).toBe(
    "592px",
  );
  unmount();
  expect(aside.style.getPropertyValue("--workspace-aside-height")).toBe("");
});
