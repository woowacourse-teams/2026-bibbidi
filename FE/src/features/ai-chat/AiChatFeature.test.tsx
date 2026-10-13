import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiChatFeature } from "./AiChatFeature";
import { AiChatApiError, streamAiChat } from "./api/streamAiChat";

const mocks = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("./api/streamAiChat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api/streamAiChat")>()),
  streamAiChat: mocks.stream,
}));

const id = "d67a9265-3f45-4d7f-99f1-b5823054c8d9";
const dialogMethods = Object.getOwnPropertyDescriptors(
  HTMLDialogElement.prototype,
);
const authRequired = vi.fn();

function chat(isAuthenticated = true) {
  return (
    <AiChatFeature
      isAuthenticated={isAuthenticated}
      onAuthenticationRequired={authRequired}
    />
  );
}
function send(text: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "메시지 전송" }));
}
function mockMobileDialog() {
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
}
function pendingReply() {
  let receiver: Parameters<typeof streamAiChat>[1];
  let signal: AbortSignal;
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((finish, fail) => {
    resolve = finish;
    reject = fail;
  });
  mocks.stream.mockImplementationOnce((_request, target, requestSignal) => {
    receiver = target;
    signal = requestSignal;
    receiver.onConversation(id);
    return promise;
  });
  return {
    delta: (text: string) => act(() => receiver.onDelta(text)),
    complete: () => act(async () => resolve()),
    fail: (error = new Error("secret failure")) =>
      act(async () => reject(error)),
    signal: () => signal,
  };
}

beforeEach(() => {
  authRequired.mockReset();
  mocks.stream.mockReset();
  mocks.stream.mockImplementation(async (_request, receiver) => {
    receiver.onConversation(id);
    receiver.onDelta("실제 AI 답변이에요.");
  });
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
    if (dialogMethods[method])
      Object.defineProperty(
        HTMLDialogElement.prototype,
        method,
        dialogMethods[method],
      );
    else
      delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)[
        method
      ];
  }
});

describe("실제 AI 채팅", () => {
  it("추천 질문으로 실제 답변을 받고 후속 메시지에 같은 대화 ID를 보낸다", async () => {
    render(chat());
    const question = "웨딩홀을 정한 다음엔 뭘 준비할까?";
    fireEvent.click(screen.getByRole("button", { name: question }));
    await screen.findByText("실제 AI 답변이에요.");
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(within(screen.getByRole("log")).getByText(question)).toBeTruthy();
    expect(screen.getByRole("log").querySelector("time")?.textContent).toMatch(
      /\d{2}:\d{2}/,
    );
    expect(screen.queryByText("예시 대화")).toBeNull();
    expect(screen.queryByText("다음으로 준비하면 좋은 일")).toBeNull();
    expect(screen.queryByRole("button", { name: "추가하기 →" })).toBeNull();
    expect(mocks.stream.mock.calls[0][0]).toEqual({
      message: question,
      conversationId: undefined,
    });
    send("그 다음은?");
    await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(2));
    expect(mocks.stream.mock.calls[1][0]).toEqual({
      message: "그 다음은?",
      conversationId: id,
    });
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("생성 중 받은 조각을 표시하고 전송을 막되 다음 메시지는 작성할 수 있다", async () => {
    const reply = pendingReply();
    render(chat());
    send("촬영 준비");
    reply.delta("촬영 전에 ");
    reply.delta("준비해요.");
    expect(screen.getByText("촬영 전에 준비해요.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("작성하고");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "다음 질문" },
    });
    expect(
      (screen.getByRole("button", { name: "메시지 전송" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(mocks.stream).toHaveBeenCalledOnce();
    await reply.complete();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "다음 질문",
    );
    expect(
      (screen.getByRole("button", { name: "메시지 전송" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(screen.queryByText("미완료 답변")).toBeNull();
  });

  it("공백·4000자 초과·한글 조합 중 Enter는 보내지 않고 완성된 줄바꿈 입력만 보낸다", async () => {
    render(chat());
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("maxlength")).toBe("4000");
    for (const value of [" \n ", "가".repeat(4001)]) {
      fireEvent.change(input, { target: { value } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(mocks.stream).not.toHaveBeenCalled();
    }
    fireEvent.change(input, { target: { value: "촬영 준비\n정리해줘" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    expect(mocks.stream).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText("실제 AI 답변이에요.");
    expect(mocks.stream.mock.calls[0][0].message).toBe("촬영 준비\n정리해줘");
    expect((input as HTMLTextAreaElement).value).toBe("");
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("중간 실패는 받은 내용을 미완료로 남기고 같은 질문을 중복 표시하지 않고 재시도한다", async () => {
    const reply = pendingReply();
    render(chat());
    send("질문");
    reply.delta("중간 답변");
    await reply.fail();
    expect(screen.getByText("중간 답변")).toBeTruthy();
    expect(screen.getByText("미완료 답변")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "끝까지 받지 못했어요",
    );
    expect(screen.queryByText("secret failure")).toBeNull();
    expect(mocks.stream).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByText("실제 AI 답변이에요.");
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.queryByText("중간 답변")).toBeNull();
    expect(screen.queryByText("미완료 답변")).toBeNull();
    expect(within(screen.getByRole("log")).getAllByText("질문")).toHaveLength(
      1,
    );
    expect(mocks.stream.mock.calls[1][0]).toEqual({
      message: "질문",
      conversationId: id,
    });
  });

  it("인증 만료는 안전하게 안내하고 기존 인증 상태를 다시 확인한다", async () => {
    mocks.stream.mockRejectedValueOnce(new AiChatApiError(401));
    render(chat());
    send("질문");
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain(
      "로그인이 만료됐어요",
    );
    expect(authRequired).toHaveBeenCalledOnce();
  });

  it("비로그인은 로그인 링크만 제공하고 API를 호출하지 않는다", () => {
    render(chat(false));
    expect(
      screen.getByRole("link", { name: "로그인" }).getAttribute("href"),
    ).toBe("/login");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("log")).toBeNull();
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("화면을 떠나면 진행 요청을 취소하고 새 화면에 이전 결과를 반영하지 않는다", async () => {
    const reply = pendingReply();
    const { unmount } = render(chat());
    send("이전 질문");
    unmount();
    expect(reply.signal().aborted).toBe(true);
    render(chat());
    reply.delta("늦은 답변");
    await reply.complete();
    expect(screen.queryByRole("log")).toBeNull();
    expect(screen.queryByText("늦은 답변")).toBeNull();
    send("새 질문");
    await screen.findByText("실제 AI 답변이에요.");
    expect(mocks.stream.mock.calls[1][0].conversationId).toBeUndefined();
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it.each(
    ["AI와 대화하기", "AI 채팅 열기"].flatMap((launcher) =>
      ["AI 채팅 닫기", "로드맵으로 돌아가기", "Escape"].map((close) => [
        launcher,
        close,
      ]),
    ),
  )(
    "%s로 열고 %s로 닫으면 실행 버튼에 포커스를 복원한다",
    async (launcherName, closeName) => {
      mockMobileDialog();
      render(chat());
      const launcher = screen.getByRole("button", { name: launcherName });
      fireEvent.click(launcher);
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).queryByText("예시")).toBeNull();
      if (closeName === "Escape")
        fireEvent(dialog, new Event("cancel", { cancelable: true }));
      else fireEvent.click(screen.getByRole("button", { name: closeName }));
      expect(screen.queryByRole("dialog")).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(launcher));
    },
  );

  it("모바일을 닫아도 답변을 계속 받고 다시 열면 대화와 작성 중 입력을 유지한다", async () => {
    const reply = pendingReply();
    mockMobileDialog();
    const viewport = Object.assign(new EventTarget(), {
      height: 844,
      offsetTop: 0,
    });
    vi.stubGlobal("visualViewport", viewport);
    render(chat());
    fireEvent.click(screen.getByRole("button", { name: "AI 채팅 열기" }));
    send("질문");
    reply.delta("앞부분 ");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "작성 중" },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 채팅 닫기" }));
    expect(reply.signal().aborted).toBe(false);
    reply.delta("뒷부분");
    await reply.complete();
    fireEvent.click(screen.getByRole("button", { name: "AI 채팅 열기" }));
    expect(screen.getByText("앞부분 뒷부분")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "작성 중",
    );
    expect(screen.getByRole("dialog").style.height).toBe("844px");
    const log = screen.getByRole("log");
    Object.defineProperty(log, "scrollHeight", {
      configurable: true,
      value: 500,
    });
    viewport.height = 400;
    viewport.offsetTop = 24;
    viewport.dispatchEvent(new Event("resize"));
    expect(log.scrollTop).toBe(500);
    expect(screen.getByRole("dialog").style.height).toBe("400px");
    expect(screen.getByRole("dialog").style.top).toBe("24px");
  });
});
