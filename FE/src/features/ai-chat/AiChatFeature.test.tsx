import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiChatFeature } from "./AiChatFeature";

const dialogMethods = Object.getOwnPropertyDescriptors(
  HTMLDialogElement.prototype,
);

function send(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "추가하고 싶은 일" }), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "메시지 전송" }));
}

function showCards() {
  send("웨딩홀을 정했어요");
  send("주례 없이 편안한 분위기로 하고 싶어");
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const method of ["showModal", "close"] as const) {
    if (dialogMethods[method]) {
      Object.defineProperty(
        HTMLDialogElement.prototype,
        method,
        dialogMethods[method],
      );
    } else {
      delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)[
        method
      ];
    }
  }
});

describe("AI 채팅 예시", () => {
  it("추천 질문을 전송하고 시간과 고정 안내를 표시한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T14:20:00+09:00"));
    render(<AiChatFeature />);
    const question = "웨딩홀을 정한 다음엔 뭘 준비할까?";
    fireEvent.click(screen.getByRole("button", { name: question }));
    const log = screen.getByRole("log");
    expect(within(log).getByText(question)).toBeTruthy();
    expect(within(log).getByText("다음으로 준비하면 좋은 일")).toBeTruthy();
    expect(
      within(log).getByText("사회자·축가·축사 맡을 사람 정하기"),
    ).toBeTruthy();
    expect(log.querySelector("time")?.textContent).toMatch(/\d{2}:\d{2}/);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    vi.useRealTimers();
  });

  it("공백·줄바꿈·한글 조합 중 Enter를 전송하지 않고 완성된 입력만 전송한다", () => {
    render(<AiChatFeature />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: " \n " } });
    expect(
      (screen.getByRole("button", { name: "메시지 전송" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.queryByRole("log")).toBeNull();

    fireEvent.change(input, { target: { value: "촬영 준비" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    expect(screen.queryByRole("log")).toBeNull();
    fireEvent.change(input, { target: { value: "촬영 준비\n정리해줘" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("log").textContent).toContain(
      "촬영 준비\n정리해줘",
    );
    expect((input as HTMLTextAreaElement).value).toBe("");
  });

  it("카드를 추가·넘기기하면 진행 상태와 완료를 표시하고 서버나 저장소를 변경하지 않는다", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<AiChatFeature />);
    showCards();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "추가하기 →" }));
    expect(screen.getByRole("status").textContent).toContain(
      "예시로 추가했어요",
    );
    expect(screen.getByText("2 / 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "← 넘기기" }));
    expect(screen.getByText("추천 할 일을 모두 확인했어요.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "추가하기 →" })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();

    send("더 추천해줘");
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(
      screen.getByRole("article", { name: "주례 없는 예식 순서 정하기" }),
    ).toBeTruthy();
  });

  it("수직 이동과 취소는 카드를 유지하고 좌우 스와이프는 추가·넘기기를 수행한다", () => {
    class TestPointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    render(<AiChatFeature />);
    showCards();
    let card = screen.getByRole("article", {
      name: "주례 없는 예식 순서 정하기",
    });
    const pointer = { pointerId: 1, button: 0 };
    fireEvent.pointerDown(card, { ...pointer, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(card, { ...pointer, clientX: 110, clientY: 200 });
    expect(screen.getByText("1 / 2")).toBeTruthy();
    fireEvent.pointerDown(card, { ...pointer, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(card, { ...pointer, clientX: 180, clientY: 100 });
    fireEvent.pointerCancel(card, pointer);
    fireEvent.pointerUp(card, { ...pointer, clientX: 180, clientY: 100 });
    expect(screen.getByText("1 / 2")).toBeTruthy();

    fireEvent.pointerDown(card, { ...pointer, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(card, { ...pointer, clientX: 180, clientY: 100 });
    expect(screen.getByRole("status").textContent).toContain(
      "예시로 추가했어요",
    );
    card = screen.getByRole("article", {
      name: "사회자·축가 맡을 사람 정하기",
    });
    fireEvent.pointerDown(card, { ...pointer, clientX: 180, clientY: 100 });
    fireEvent.pointerUp(card, { ...pointer, clientX: 100, clientY: 100 });
    expect(screen.getByText("추천 할 일을 모두 확인했어요.")).toBeTruthy();
  });

  it("모바일을 닫고 다시 열어도 대화·작성 중 입력·카드 진행을 유지한다", () => {
    const viewport = Object.assign(new EventTarget(), {
      height: 844,
      offsetTop: 0,
    });
    vi.stubGlobal("visualViewport", viewport);
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.setAttribute("open", "");
        },
      },
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.removeAttribute("open");
        },
      },
    });
    const { unmount } = render(<AiChatFeature />);
    fireEvent.click(screen.getByRole("button", { name: "AI와 할 일 만들기" }));
    showCards();
    const dialog = screen.getByRole("dialog");
    expect(dialog.style.height).toBe("844px");
    const log = screen.getByRole("log");
    Object.defineProperty(log, "scrollHeight", {
      configurable: true,
      value: 500,
    });
    viewport.height = 400;
    viewport.offsetTop = 24;
    viewport.dispatchEvent(new Event("resize"));
    expect(dialog.style.height).toBe("400px");
    expect(dialog.style.top).toBe("24px");
    expect(log.scrollTop).toBe(500);
    fireEvent.click(screen.getByRole("button", { name: "추가하기 →" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "작성 중" },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 채팅 닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "AI 채팅 열기" }));
    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "작성 중",
    );
    const submit = screen.getByRole("button", { name: "메시지 전송" });
    const back = screen.getByRole("button", { name: "로드맵으로 돌아가기" });
    submit.focus();
    fireEvent.keyDown(submit, { key: "Tab" });
    expect(document.activeElement).toBe(back);
    fireEvent.keyDown(back, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(submit);
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { cancelable: true }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "AI 채팅 열기" }));
    fireEvent.click(
      screen.getByRole("button", { name: "로드맵으로 돌아가기" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();
    render(<AiChatFeature />);
    fireEvent.click(screen.getByRole("button", { name: "AI 채팅 열기" }));
    expect(screen.queryByRole("log")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });
});
