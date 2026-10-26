import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../../shared/responsive";
import { installMatchMedia } from "../../../test/matchMedia";
import { useChecklistAppointmentCreation } from "../useChecklistAppointmentCreation";
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
    { id: "20", title: "스드메", items: [] },
  ],
});
let available = 1280;
let notify: () => void;
let media: ReturnType<typeof installMatchMedia>;

function Harness({
  loginRequiredReason = null,
  onCancelLoginRequired,
}: {
  loginRequiredReason?: "schedule-creation" | null;
  onCancelLoginRequired?: () => void;
} = {}) {
  const [selected, setSelected] = useState<string | null>(null);
  const creation = useChecklistTaskCreation({});
  const appointment = useChecklistAppointmentCreation({
    checklistItemId: selected ? 500 : null,
    isAuthenticated: true,
    confirmDiscard: true,
    onSubmit: () => false,
  });
  return (
    <div className="service-layout" data-modal-scope>
      <header className="service-layout__header">
        <button type="button">계정 메뉴</button>
      </header>
      <div data-page-scroll-container>
        <Checklist
          categories={categories}
          loginRequiredReason={loginRequiredReason}
          onCancelLoginRequired={onCancelLoginRequired}
          selectedTaskId={selected}
          onSelectTask={setSelected}
          onCloseTaskDetail={() => setSelected(null)}
          onBackTaskDetail={() => setSelected(null)}
          onOpenTaskCreation={creation.open}
          taskCreation={creation}
          appointmentCreation={appointment}
          onRequestScheduleCreation={appointment.open}
        />
      </div>
    </div>
  );
}

function clickDimmer() {
  const layer = document.querySelector(".bibbidi-panel-overlay[open]")!;
  for (const type of ["pointerdown", "pointerup"])
    fireEvent(layer, new MouseEvent(type, { bubbles: true, button: 0 }));
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

it("상세를 병렬 패널·오버레이·바텀시트로 바꾸고 닫으면 목록 초점과 스크롤을 복원한다", async () => {
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
  expect(screen.getAllByRole("dialog", { name: "웨딩홀 방문" })).toHaveLength(
    1,
  );
  expect(dialog.tagName).toBe("DIALOG");
  expect(dialog.classList.contains("bibbidi-panel-overlay")).toBe(true);
  expect((dialog as HTMLDialogElement).open).toBe(true);
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  const panel = document.getElementById("checklist-task-detail-panel")!;
  expect(panel.closest("dialog")).toBe(dialog);
  expect(dialog.querySelector('[role="dialog"], dialog')).toBeNull();
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
  await act(async () => {});
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
  clickDimmer();
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

it.each([false, true])(
  "카테고리 팝업의 Escape는 작성창을 닫지 않는다 (입력=%s)",
  (dirty) => {
    render(<Harness />);
    resize(1024);
    fireEvent.click(screen.getByRole("button", { name: "할 일 추가" }));
    if (dirty)
      fireEvent.change(screen.getByLabelText(/할 일 제목/), {
        target: { value: "입력 유지" },
      });
    const select = screen.getByRole("combobox");
    select.focus();
    fireEvent.click(select);
    fireEvent.keyDown(select, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "할 일 추가" })).toBeTruthy();
    expect(
      screen.queryByRole("dialog", { name: "작성 중인 내용을 닫을까요?" }),
    ).toBeNull();
  },
);

it.each([390, 1024, 1440])(
  "일정 변경 후 닫기는 확인을 거치고 계속 작성 시 입력·초점을 보존한다 (%s)",
  async (width) => {
    render(<Harness />);
    resize(width);
    fireEvent.click(screen.getByRole("button", { name: /웨딩홀 방문/ }));
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "일정 추가" }));
    const title = screen.getByRole("textbox", { name: /제목/ });
    fireEvent.change(title, { target: { value: "보존할 상담 일정" } });
    title.focus();
    fireEvent.keyDown(title, { key: "Escape" });
    let discard = screen.getByRole("dialog", {
      name: "작성 중인 내용을 닫을까요?",
    });
    expect(document.activeElement?.textContent).toContain("계속 작성");
    fireEvent.click(within(discard).getByRole("button", { name: "계속 작성" }));
    await act(async () => {});
    expect(
      (screen.getByRole("textbox", { name: /제목/ }) as HTMLInputElement).value,
    ).toBe("보존할 상담 일정");
    expect(document.activeElement).toBe(title);
    if (width === 1024) clickDimmer();
    else if (width === 390)
      fireEvent.click(
        screen.getByRole("button", { name: "할 일 상세로 돌아가기" }),
      );
    else fireEvent.click(screen.getByRole("button", { name: "취소" }));
    discard = screen.getByRole("dialog", {
      name: "작성 중인 내용을 닫을까요?",
    });
    fireEvent.keyDown(
      within(discard).getByRole("button", { name: "계속 작성" }),
      { key: "Escape" },
    );
    await act(async () => {});
    expect(screen.getByRole("textbox", { name: /제목/ })).toBe(title);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(screen.getByRole("button", { name: "나가기" }));
    await act(async () => {});
    expect(screen.queryByRole("textbox", { name: /제목/ })).toBeNull();
    expect(screen.getByRole("button", { name: "일정 추가" })).toBeTruthy();
  },
);

it("실제 레이아웃 너비로 Tab과 Radio를 전환하고 현재 위치와 선택을 유지한다", () => {
  render(<Harness />);
  const category = screen.getByRole("radio", {
    name: "예식장 0/1",
  }) as HTMLInputElement;
  fireEvent.click(category);
  expect(category.checked).toBe(true);
  const breadcrumb = screen.getByRole("navigation", { name: "현재 위치" });
  expect(within(breadcrumb).getByText("체크리스트")).toBeTruthy();
  expect(
    within(breadcrumb).getByText("예식장").getAttribute("aria-current"),
  ).toBe("page");
  expect(screen.queryByRole("tablist")).toBeNull();
  for (const width of [390, 1024]) {
    resize(width);
    const tab = screen.getByRole("tab", { name: "예식장 0/1" });
    const panel = screen.getByRole("tabpanel", { name: "예식장 0/1" });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(tab.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
    expect(panel.tabIndex).toBe(0);
  }
  resize(1440, 560);
  expect(screen.getByRole("tablist")).toBeTruthy();
  resize(1440, 1280);
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(
    (screen.getByRole("radio", { name: "예식장 0/1" }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "스드메 0/0" }));
  expect(
    within(breadcrumb).getByText("스드메").getAttribute("aria-current"),
  ).toBe("page");
  expect(
    screen.getByRole("heading", { level: 1, name: "스드메" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "초기화" })).toBeNull();
});

it.each([1280, 1440])(
  "상세를 연 뒤 카테고리를 바꿔도 선택 컨트롤의 초점을 유지한다 (%s)",
  (width) => {
    render(<Harness />);
    resize(width);
    fireEvent.click(screen.getByRole("button", { name: /웨딩홀 방문/ }));
    expect(
      screen.getByRole("complementary", { name: "웨딩홀 방문" }),
    ).toBeTruthy();
    const role = width === 1440 ? "radio" : "tab";
    const category = screen.getByRole(role, { name: "스드메 0/0" });
    category.focus();
    fireEvent.click(category);
    expect(
      screen.queryByRole("complementary", { name: "웨딩홀 방문" }),
    ).toBeNull();
    expect(document.activeElement).toBe(category);
    if (role === "tab") {
      fireEvent.keyDown(category, { key: "ArrowLeft" });
      expect(document.activeElement).toBe(
        screen.getByRole("tab", { name: "예식장 0/1" }),
      );
    }
  },
);

it("취소 확인창을 연 채 배치를 바꿔도 확인창이 마지막에 열리고 작성값을 보존한다", async () => {
  const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "할 일 추가" }));
  fireEvent.change(screen.getByLabelText(/할 일 제목/), {
    target: { value: "확인 중인 할 일" },
  });
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  for (const width of [1024, 390, 1440]) {
    resize(width);
    const confirmation = screen.getByRole("dialog", {
      name: "작성 중인 내용을 닫을까요?",
    });
    expect(confirmation.parentElement).toBe(document.body);
    expect(confirmation.closest('[inert], [aria-hidden="true"]')).toBeNull();
    expect(showModal.mock.contexts.at(-1)).toBe(confirmation);
    expect(document.activeElement?.textContent).toContain("계속 작성");
  }
  fireEvent.click(screen.getByRole("button", { name: "계속 작성" }));
  await act(async () => {});
  expect((screen.getByLabelText(/할 일 제목/) as HTMLInputElement).value).toBe(
    "확인 중인 할 일",
  );
});

it.each([390, 1024])(
  "일정 선택기를 닫아도 작성 오버레이와 배경 스크롤 잠금을 유지한다 (%s)",
  async (width) => {
    const { container } = render(<Harness />);
    resize(width);
    fireEvent.click(screen.getByRole("button", { name: /웨딩홀 방문/ }));
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "일정 추가" }));
    fireEvent.change(screen.getByRole("textbox", { name: /제목/ }), {
      target: { value: "작성 중인 일정" },
    });
    const dateTrigger = screen.getByRole("button", { name: /^날짜 / });
    dateTrigger.focus();
    fireEvent.click(dateTrigger);
    const picker = screen.getByRole("dialog", { name: "날짜 선택" });
    fireEvent.keyDown(within(picker).getByRole("button", { name: "확인" }), {
      key: "Escape",
    });
    await act(async () => {});
    expect(screen.queryByRole("dialog", { name: "날짜 선택" })).toBeNull();
    expect(
      screen
        .getByRole("dialog", { name: "일정 추가" })
        .classList.contains("bibbidi-panel-overlay"),
    ).toBe(true);
    expect(
      (screen.getByRole("textbox", { name: /제목/ }) as HTMLInputElement).value,
    ).toBe("작성 중인 일정");
    expect(document.activeElement).toBe(dateTrigger);
    expect(document.body.style.overflow).toBe("hidden");
    expect(
      container.querySelector<HTMLElement>("[data-page-scroll-container]")!
        .style.overflow,
    ).toBe("hidden");
  },
);

it("전역 확인창을 연 상태로 배치를 전환해도 상위 패널이 확인창을 덮지 않는다", () => {
  const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
  const onCancelLoginRequired = vi.fn();
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: /웨딩홀 방문/ }));
  view.rerender(
    <Harness
      loginRequiredReason="schedule-creation"
      onCancelLoginRequired={onCancelLoginRequired}
    />,
  );
  for (const width of [1024, 390, 1440]) {
    resize(width);
    const confirmation = screen.getByRole("dialog", {
      name: "로그인이 필요해요",
    });
    expect(confirmation.parentElement).toBe(document.body);
    expect(confirmation.closest('[inert], [aria-hidden="true"]')).toBeNull();
    expect(showModal.mock.contexts.at(-1)).toBe(confirmation);
    expect(document.activeElement?.textContent).toBe("취소");
  }
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(onCancelLoginRequired).toHaveBeenCalledOnce();
});

it("오버레이는 본문과 배경막 퇴장이 끝날 때까지 내용·스크롤 잠금을 유지한다", async () => {
  const { container } = render(<Harness />);
  resize(1024);
  const trigger = screen.getByRole("button", { name: /웨딩홀 방문/ });
  trigger.focus();
  fireEvent.click(trigger);
  const layer = screen.getByRole("dialog", { name: "웨딩홀 방문" });
  const scroll = container.querySelector<HTMLElement>(
    "[data-page-scroll-container]",
  )!;
  scroll.scrollTop = 180;
  let finishPanel!: () => void;
  let finishDimmer!: () => void;
  const panelFinished = new Promise<void>((resolve) => {
    finishPanel = resolve;
  });
  const dimmerFinished = new Promise<void>((resolve) => {
    finishDimmer = resolve;
  });
  Object.defineProperty(layer.firstElementChild, "getAnimations", {
    value: () => [{ finished: panelFinished }],
  });
  Object.defineProperty(layer, "getAnimations", {
    value: () => [{ finished: dimmerFinished }],
  });
  const surface = layer.firstElementChild as HTMLElement;
  surface.style.transform = "matrix(1, 0, 0, 1, 70, 0)";
  fireEvent.click(
    within(layer).getByRole("button", { name: "할 일 상세 닫기" }),
  );
  expect(layer.dataset.state).toBe("closing");
  expect(surface.style.getPropertyValue("--panel-overlay-exit-transform")).toBe(
    "matrix(1, 0, 0, 1, 70, 0)",
  );
  expect(within(layer).getByText("등록된 일정이 없어요.")).toBeTruthy();
  expect(
    document.querySelector(".checklist-workspace__main")?.hasAttribute("inert"),
  ).toBe(true);
  expect(scroll.style.overflow).toBe("hidden");
  await act(async () => finishPanel());
  expect((layer as HTMLDialogElement).open).toBe(true);
  expect(document.body.style.overflow).toBe("hidden");
  await act(async () => finishDimmer());
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).toBe("");
  expect(scroll.style.overflow).toBe("");
  expect(scroll.scrollTop).toBe(180);
  expect(document.activeElement).toBe(trigger);
});

it("작성 취소 확인 뒤에도 퇴장 중인 폼의 입력을 유지하고 확인창은 남기지 않는다", async () => {
  render(<Harness />);
  resize(1024);
  const trigger = screen.getByRole("button", { name: "할 일 추가" });
  fireEvent.click(trigger);
  fireEvent.change(screen.getByRole("textbox", { name: /할 일 제목/ }), {
    target: { value: "퇴장 중 유지할 제목" },
  });
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  const layer = document.querySelector<HTMLDialogElement>(
    ".bibbidi-panel-overlay",
  )!;
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  Object.defineProperty(layer.firstElementChild, "getAnimations", {
    value: () => [{ finished }],
  });
  fireEvent.click(screen.getByRole("button", { name: "나가기" }));
  expect(layer.dataset.state).toBe("closing");
  expect(layer.querySelector<HTMLInputElement>("input")?.value).toBe(
    "퇴장 중 유지할 제목",
  );
  expect(
    screen.queryByRole("dialog", { name: "작성 중인 내용을 닫을까요?" }),
  ).toBeNull();
  await act(async () => finish());
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
