import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../../shared/responsive";
import { installMatchMedia } from "../../../test/matchMedia";
import { useChecklistTaskCreation } from "../useChecklistTaskCreation";
import { createChecklistViewModel } from "../view-model/createChecklistViewModel";
import { Checklist } from "./Checklist";

const tokens: Record<string, string> = {
  "--layout-breakpoint-md": "768px",
  "--layout-breakpoint-lg": "1280px",
  "--layout-breakpoint-xl": "1440px",
  "--layout-width-category": "176px",
  "--layout-width-detail": "400px",
  "--layout-width-main-min": "560px",
  "--layout-gutter-desktop": "24px",
};
const categories = createChecklistViewModel({
  categories: [
    {
      id: "10",
      title: "예식장",
      items: [
        {
          appointments: [],
          categoryId: "10",
          checklistItemId: 500,
          id: "checklist-item-500",
          sourceCatalogItemId: null,
          status: "prev",
          title: "웨딩홀 방문",
        },
      ],
    },
  ],
});
let available = 1280;
let notify: () => void;
let media: ReturnType<typeof installMatchMedia>;

function Harness() {
  const [selected, setSelected] = useState<string | null>(null);
  const creation = useChecklistTaskCreation({});
  return (
    <div className="service-layout">
      <header className="service-layout__header">
        <button type="button">계정 메뉴</button>
      </header>
      <div data-page-scroll-container>
        <Checklist
          categories={categories}
          selectedTaskId={selected}
          onSelectTask={setSelected}
          onCloseTaskDetail={() => setSelected(null)}
          onBackTaskDetail={() => setSelected(null)}
          onOpenTaskCreation={creation.open}
          taskCreation={creation}
        />
      </div>
    </div>
  );
}

function resize(width: number, parentWidth = width - 64) {
  available = parentWidth;
  act(() => {
    vi.stubGlobal("innerWidth", width);
    media.setMatches(width < 768);
    notify();
    window.dispatchEvent(new Event("resize"));
  });
}

beforeEach(() => {
  available = 1280;
  media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
  vi.stubGlobal("innerWidth", 1440);
  vi.stubGlobal(
    "ResizeObserver",
    class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notify = () => callback([], this);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const computed = window.getComputedStyle;
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const styles = computed(element, pseudo);
    if (!element.classList.contains("bibbidi-workspace-layout")) return styles;
    return new Proxy(styles, {
      get(target, key) {
        if (key === "getPropertyValue")
          return (name: string) =>
            tokens[name] ?? target.getPropertyValue(name);
        return Reflect.get(target, key, target);
      },
    });
  });
  const bounds = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (!this.classList.contains("bibbidi-workspace-layout"))
        return bounds.call(this);
      return { ...bounds.call(this), width: available };
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("상세를 병렬 패널·오버레이·바텀시트로 바꾸고 닫으면 목록 초점과 스크롤을 복원한다", () => {
  const { container } = render(<Harness />);
  const trigger = screen.getByRole("button", { name: /웨딩홀 방문/ });
  const scroll = container.querySelector<HTMLElement>(
    "[data-page-scroll-container]",
  )!;
  scroll.scrollTop = 250;
  fireEvent.click(trigger);
  expect(
    screen.getByRole("complementary", { name: "웨딩홀 방문" }),
  ).toBeTruthy();
  resize(1024);
  const dialog = screen.getByRole("dialog", { name: "웨딩홀 방문" });
  expect(
    container.querySelector(".service-layout__header")?.hasAttribute("inert"),
  ).toBe(true);
  expect(scroll.style.overflow).toBe("hidden");
  const close = within(dialog).getByRole("button", { name: "할 일 상세 닫기" });
  close.focus();
  fireEvent.keyDown(close, { key: "Tab" });
  expect(dialog.contains(document.activeElement)).toBe(true);
  resize(390);
  expect(
    container.querySelector(".checklist-detail-bottom-sheet"),
  ).toBeTruthy();
  resize(1440, 560);
  expect(screen.getByRole("dialog", { name: "웨딩홀 방문" })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("button", { name: "할 일 상세 닫기" }), {
    key: "Escape",
  });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(scroll.scrollTop).toBe(250);
  expect(scroll.style.overflow).toBe("");
});

it("작성값을 크기 전환에서 유지하고 오버레이 위의 버리기 확인창만 먼저 닫는다", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "할 일 추가" }));
  const title = screen.getByLabelText(/할 일 제목/);
  fireEvent.change(title, { target: { value: "입력 유지" } });
  for (const width of [1024, 390, 1440]) {
    resize(width);
    expect(
      (screen.getByLabelText(/할 일 제목/) as HTMLInputElement).value,
    ).toBe("입력 유지");
  }
  resize(1024);
  fireEvent.click(screen.getByRole("button", { name: "패널 닫기" }));
  const discard = screen.getByRole("dialog", {
    name: "작성 중인 내용을 닫을까요?",
  });
  fireEvent.keyDown(discard, { key: "Escape" });
  expect(
    screen.queryByRole("dialog", { name: "작성 중인 내용을 닫을까요?" }),
  ).toBeNull();
  expect((screen.getByLabelText(/할 일 제목/) as HTMLInputElement).value).toBe(
    "입력 유지",
  );
  expect(screen.getByRole("dialog", { name: "할 일 추가" })).toBeTruthy();
});
