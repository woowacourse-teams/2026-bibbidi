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
import { installMatchMedia } from "../../test/matchMedia";
import { installDialogMock } from "../../test/dialog";
import { MyChecklistProvider } from "../checklist";

const mocks = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("./api/streamAiChat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api/streamAiChat")>()),
  streamAiChat: mocks.stream,
}));

const id = "d67a9265-3f45-4d7f-99f1-b5823054c8d9";
let restoreDialog: (() => void) | undefined;
const authRequired = vi.fn();

function chat(isAuthenticated = true) {
  return (
    <MyChecklistProvider sessionKey="ai-chat-test">
      <AiChatFeature
        isAuthenticated={isAuthenticated}
        onAuthenticationRequired={authRequired}
      />
    </MyChecklistProvider>
  );
}
async function send(text: string) {
  fireEvent.change(await screen.findByRole("textbox"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "메시지 전송" }));
}
function mockMobileDialog() {
  vi.mocked(window.matchMedia).mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  restoreDialog = installDialogMock();
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
  restoreDialog?.();
  restoreDialog = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("실제 AI 채팅", () => {
  it("모바일은 처음 열 때 채팅을 표시하고 데스크톱으로 전환해도 대화와 입력을 유지한다", async () => {
    mockMobileDialog();
    const media = installMatchMedia("(width < 768px)", true);
    render(chat());
    expect(screen.queryByText("어떤 준비를 도와드릴까요?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
    await send("준비 순서");
    await screen.findByText("실제 AI 답변이에요.");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "다음 질문 작성 중" },
    });
    act(() => media.setMatches(false));
    expect(screen.getByRole("log").textContent).toContain(
      "실제 AI 답변이에요.",
    );
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      "다음 질문 작성 중",
    );
    act(() => media.setMatches(true));
    fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
    expect(screen.getByRole("log").textContent).toContain(
      "실제 AI 답변이에요.",
    );
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      "다음 질문 작성 중",
    );
  });

  it("추천 질문으로 실제 답변을 받고 후속 메시지에 같은 대화 ID를 보낸다", async () => {
    render(chat());
    const question = "웨딩홀을 정한 다음엔 뭘 준비할까?";
    fireEvent.click(await screen.findByRole("button", { name: question }));
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
    await send("그 다음은?");
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
    await send("촬영 준비");
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
    const input = await screen.findByRole("textbox");
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

  it.each([false, true])(
    "모바일 여부 %s에서 수신 중 나뉜 마크다운을 누적해 표시하고 사용자 입력은 텍스트로 유지한다",
    async (isMobile) => {
      const reply = pendingReply();
      if (isMobile) mockMobileDialog();
      render(chat());
      if (isMobile)
        fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
      await send("**준비** 알려줘");
      expect(screen.getByText("**준비** 알려줘").tagName).toBe("P");
      reply.delta("## 준비 순서\n\n**웨딩");
      expect(screen.getByRole("heading", { name: "준비 순서" })).toBeTruthy();
      expect(screen.getByText("**웨딩").tagName).toBe("P");
      reply.delta("홀** 예약\n\n| 항목 | 비용 |\n");
      expect(screen.getByText("웨딩홀").tagName).toBe("STRONG");
      expect(screen.queryByRole("table")).toBeNull();
      reply.delta("| --- | --- |\n| 대관 | 100만 원 |\n\n``");
      expect(screen.getByRole("cell", { name: "100만 원" })).toBeTruthy();
      reply.delta("`ts\nconst wedding = true;\n");
      const code = screen.getByText("const wedding = true;");
      expect(code.tagName).toBe("CODE");
      expect(code.parentElement?.tagName).toBe("PRE");
      reply.delta("```\n\n- [x] 예약 완료");
      expect(screen.getByRole<HTMLInputElement>("checkbox").checked).toBe(true);
      expect(screen.getByRole("status")).toBeTruthy();
      await reply.complete();
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.getByText("웨딩홀").tagName).toBe("STRONG");
      expect(screen.getByRole("table")).toBeTruthy();
    },
  );

  it("중간 실패는 받은 내용을 미완료로 남기고 같은 질문을 중복 표시하지 않고 재시도한다", async () => {
    const reply = pendingReply();
    render(chat());
    await send("질문");
    reply.delta("**중간 답변**");
    await reply.fail();
    expect(screen.getByText("중간 답변")).toBeTruthy();
    expect(screen.getByText("중간 답변").tagName).toBe("STRONG");
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

  it.each([false, true])(
    "모바일 여부 %s에서 한도 초과는 별도로 안내하고 미완료 답변을 수동 재시도한다",
    async (isMobile) => {
      const reply = pendingReply();
      if (isMobile) mockMobileDialog();
      render(chat());
      if (isMobile)
        fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
      await send("질문");
      reply.delta("중간 답변");
      await reply.fail(new AiChatApiError(undefined, 902));
      expect(screen.getByRole("alert").textContent).toContain(
        "요청이 많아 AI가 답변하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      expect(screen.getByText("중간 답변")).toBeTruthy();
      expect(screen.getByText("미완료 답변")).toBeTruthy();
      expect(screen.queryByRole("status")).toBeNull();
      expect(authRequired).not.toHaveBeenCalled();
      expect(mocks.stream).toHaveBeenCalledOnce();

      fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
      await screen.findByText("실제 AI 답변이에요.");
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByText("중간 답변")).toBeNull();
      expect(screen.queryByText("미완료 답변")).toBeNull();
      expect(within(screen.getByRole("log")).getAllByText("질문")).toHaveLength(
        1,
      );
      expect(mocks.stream).toHaveBeenCalledTimes(2);
      expect(mocks.stream.mock.calls[1][0]).toEqual({
        message: "질문",
        conversationId: id,
      });
    },
  );

  it.each([901, 999, undefined])(
    "오류 코드 %s는 기존 공통 실패 안내를 표시한다",
    async (errorCode) => {
      mocks.stream.mockRejectedValueOnce(
        new AiChatApiError(undefined, errorCode),
      );
      render(chat());
      await send("질문");
      expect((await screen.findByRole("alert")).textContent).toContain(
        "답변을 끝까지 받지 못했어요. 다시 시도해 주세요.",
      );
      expect(authRequired).not.toHaveBeenCalled();
    },
  );

  it("인증 만료는 안전하게 안내하고 기존 인증 상태를 다시 확인한다", async () => {
    mocks.stream.mockRejectedValueOnce(new AiChatApiError(401));
    render(chat());
    await send("질문");
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain(
      "로그인이 만료됐어요",
    );
    expect(authRequired).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    "모바일 여부 %s에서 비로그인 사용자에게 채팅 UI와 로그인 placeholder를 표시하고 전송을 막는다",
    async (isMobile) => {
      if (isMobile) mockMobileDialog();
      render(chat(false));
      if (isMobile)
        fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));

      expect(
        await screen.findByRole("heading", {
          name: "어떤 준비를 도와드릴까요?",
        }),
      ).toBeTruthy();
      const input = await screen.findByRole<HTMLTextAreaElement>("textbox");
      expect(input.placeholder).toBe("로그인 후 AI와 대화할 수 있어요");
      expect(input.disabled).toBe(true);
      for (const question of [
        "웨딩홀을 정한 다음엔 뭘 준비할까?",
        "촬영 전에 준비할 일을 정리해줘",
      ]) {
        const button = screen.getByRole<HTMLButtonElement>("button", {
          name: question,
        });
        expect(button.disabled).toBe(false);
      }
      expect(
        screen.getByRole<HTMLButtonElement>("button", { name: "메시지 전송" })
          .disabled,
      ).toBe(true);
      fireEvent.change(input, { target: { value: "질문" } });
      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.submit(input.closest("form")!);
      expect(input.value).toBe("");
      expect(screen.queryByRole("log")).toBeNull();
      expect(mocks.stream).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "모바일 여부 %s에서 비로그인 추천 질문은 질문·로그인 안내·로그인 링크를 표시한다",
    async (isMobile) => {
      if (isMobile) mockMobileDialog();
      const { rerender } = render(chat(false));
      if (isMobile)
        fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
      const question = "웨딩홀을 정한 다음엔 뭘 준비할까?";
      fireEvent.click(await screen.findByRole("button", { name: question }));
      const log = screen.getByRole("log");
      expect(within(log).getByText(question)).toBeTruthy();
      expect(
        within(log).getByText(
          "로그인하면 나에게 맞는 준비를 추천받을 수 있어요.",
        ),
      ).toBeTruthy();
      expect(
        within(log)
          .getByRole("link", { name: "로그인하기" })
          .getAttribute("href"),
      ).toBe("/login");
      expect(screen.getByRole<HTMLTextAreaElement>("textbox").disabled).toBe(
        true,
      );
      expect(mocks.stream).not.toHaveBeenCalled();
      expect(authRequired).not.toHaveBeenCalled();
      rerender(chat());
      expect(screen.queryByRole("link", { name: "로그인하기" })).toBeNull();
      expect(screen.getByRole<HTMLTextAreaElement>("textbox").disabled).toBe(
        false,
      );
      rerender(chat(false));
      expect(screen.queryByRole("log")).toBeNull();
    },
  );

  it("로그인하면 채팅 입력을 활성화하고 로그아웃하면 대화 대신 로그인 placeholder를 표시한다", async () => {
    const { rerender } = render(chat(false));
    rerender(chat());
    let input = await screen.findByRole<HTMLTextAreaElement>("textbox");
    expect(input.disabled).toBe(false);
    expect(input.placeholder).toBe("궁금한 준비를 이야기해요");
    await send("질문");
    await screen.findByText("실제 AI 답변이에요.");
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    rerender(chat(false));
    input = screen.getByRole<HTMLTextAreaElement>("textbox");
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toBe("로그인 후 AI와 대화할 수 있어요");
    expect(screen.queryByRole("log")).toBeNull();
    expect(screen.queryByText("실제 AI 답변이에요.")).toBeNull();
    expect(mocks.stream).toHaveBeenCalledOnce();
  });

  it("화면을 떠나면 진행 요청을 취소하고 새 화면에 이전 결과를 반영하지 않는다", async () => {
    const reply = pendingReply();
    const { unmount } = render(chat());
    await send("이전 질문");
    unmount();
    expect(reply.signal().aborted).toBe(true);
    render(chat());
    reply.delta("늦은 답변");
    await reply.complete();
    expect(screen.queryByRole("log")).toBeNull();
    expect(screen.queryByText("늦은 답변")).toBeNull();
    await send("새 질문");
    await screen.findByText("실제 AI 답변이에요.");
    expect(mocks.stream.mock.calls[1][0].conversationId).toBeUndefined();
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it.each(["AI 채팅 닫기", "로드맵으로 돌아가기", "Escape"])(
    "AI와 대화하기로 열고 %s로 닫으면 실행 버튼에 포커스를 복원한다",
    async (closeName) => {
      mockMobileDialog();
      render(chat());
      const launcher = screen.getByRole("button", { name: "AI와 대화하기" });
      expect(screen.queryByRole("button", { name: "AI 채팅 열기" })).toBeNull();
      fireEvent.click(launcher);
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).queryByText("예시")).toBeNull();
      if (closeName === "Escape")
        fireEvent(dialog, new Event("cancel", { cancelable: true }));
      else fireEvent.click(screen.getByRole("button", { name: closeName }));
      expect(screen.queryByRole("dialog")).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(launcher));
    },
  );

  it("모바일 화면 높이가 줄어들면 새 높이를 반영한 뒤 대화 하단으로 이동한다", async () => {
    mockMobileDialog();
    const viewport = Object.assign(new EventTarget(), {
      height: 844,
      offsetTop: 0,
    });
    vi.stubGlobal("visualViewport", viewport);
    render(chat());
    fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
    await send("질문");
    await screen.findByText("실제 AI 답변이에요.");
    const dialog = screen.getByRole("dialog");
    const log = screen.getByRole("log");
    let position = 0;
    Object.defineProperties(log, {
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: {
        configurable: true,
        get: () => position,
        set: (value: number) => {
          position = Math.max(
            0,
            Math.min(value, 1000 - Number.parseFloat(dialog.style.height)),
          );
        },
      },
    });
    log.scrollTop = log.scrollHeight;
    expect(log.scrollTop).toBe(156);

    viewport.height = 400;
    viewport.dispatchEvent(new Event("resize"));
    expect(dialog.style.height).toBe("400px");
    expect(log.scrollTop).toBe(600);

    viewport.height = 844;
    viewport.dispatchEvent(new Event("resize"));
    expect(log.scrollTop).toBe(156);
  });

  it("모바일을 닫아도 답변을 계속 받고 다시 열면 대화와 작성 중 입력을 유지한다", async () => {
    const reply = pendingReply();
    mockMobileDialog();
    const viewport = Object.assign(new EventTarget(), {
      height: 844,
      offsetTop: 0,
    });
    vi.stubGlobal("visualViewport", viewport);
    render(chat());
    fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
    await send("질문");
    reply.delta("앞부분 ");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "작성 중" },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 채팅 닫기" }));
    expect(reply.signal().aborted).toBe(false);
    reply.delta("뒷부분");
    await reply.complete();
    fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
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
