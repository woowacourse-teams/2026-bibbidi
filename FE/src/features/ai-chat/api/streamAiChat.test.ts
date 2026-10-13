import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  acceptWebAccessToken,
  resetWebAuthSessionForTest,
} from "../../../infrastructure/auth/webSessionManager";
import { AiChatApiError, streamAiChat } from "./streamAiChat";

const id = "d67a9265-3f45-4d7f-99f1-b5823054c8d9";
const otherId = "d67a9265-3f45-4d7f-99f1-b5823054c8d8";
const encoder = new TextEncoder();
const conversation = `event: conversation\ndata: {"conversationId":"${id}"}\n\n`;
const done = `event: done\ndata: {"conversationId":"${id}"}\n\n`;
const delta = (text: string) =>
  `event: delta\ndata: ${JSON.stringify({ text })}\n\n`;
const fetchMock = vi.fn();

function response(chunks: Uint8Array[], cancel = vi.fn()) {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
      cancel,
    }),
    { headers: { "Content-Type": "text/event-stream; charset=utf-8" } },
  );
}

function receive(conversationId?: string) {
  const receiver = { onConversation: vi.fn(), onDelta: vi.fn() };
  const controller = new AbortController();
  const promise = streamAiChat(
    { message: "준비를 도와줘", conversationId },
    receiver,
    controller.signal,
  );
  return { receiver, controller, promise };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  resetWebAuthSessionForTest();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AI 채팅 SSE 통신", () => {
  it("연결이 열린 동안 도착한 답변을 완료 이벤트보다 먼저 전달한다", async () => {
    let source!: ReadableStreamDefaultController<Uint8Array>;
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            source = controller;
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    const { receiver, promise } = receive();
    let completed = false;
    const completion = promise.then(() => {
      completed = true;
    });
    source.enqueue(encoder.encode(conversation + delta("먼저 도착한 답변 ")));
    await vi.waitFor(() =>
      expect(receiver.onDelta).toHaveBeenCalledWith("먼저 도착한 답변 "),
    );
    expect(completed).toBe(false);
    source.enqueue(encoder.encode(delta("다음 답변")));
    await vi.waitFor(() =>
      expect(receiver.onDelta.mock.calls.flat()).toEqual([
        "먼저 도착한 답변 ",
        "다음 답변",
      ]),
    );
    expect(completed).toBe(false);
    source.enqueue(encoder.encode(done));
    await completion;
    expect(completed).toBe(true);
  });

  it("기존 인증을 포함한 POST로 대화 ID를 보내고 한글 바이트와 이벤트 경계를 복원한다", async () => {
    const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 }))}.signature`;
    acceptWebAccessToken(token);
    const bytes = encoder.encode(conversation + delta("한글 \n 답변 ") + done);
    fetchMock.mockResolvedValue(
      response(Array.from(bytes, (byte) => new Uint8Array([byte]))),
    );
    const { receiver, promise } = receive(id);
    await promise;
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/ai/chat");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(new Headers(init.headers).get("Authorization")).toBe(
      `Bearer ${token}`,
    );
    expect(new Headers(init.headers).get("Accept")).toBe("text/event-stream");
    expect(JSON.parse(init.body as string)).toEqual({
      message: "준비를 도와줘",
      conversationId: id,
    });
    expect(receiver.onConversation).toHaveBeenCalledWith(id);
    expect(receiver.onDelta).toHaveBeenCalledExactlyOnceWith("한글 \n 답변 ");
  });

  it.each(["\n", "\r\n", "\r"])(
    "%j 줄바꿈, 여러 data 행과 주석을 처리하고 공백을 보존한다",
    async (newline) => {
      const multiLine =
        'event: delta\ndata: {\ndata: "text": " 첫 답변 "\ndata: }\n\n';
      const text = (
        ": heartbeat\n\nevent: ping\ndata: ignored\n\n" +
        conversation +
        multiLine +
        delta("둘째") +
        done
      ).replaceAll("\n", newline);
      const bytes = encoder.encode(text);
      fetchMock.mockResolvedValue(
        response(Array.from(bytes, (byte) => new Uint8Array([byte]))),
      );
      const { receiver, promise } = receive();
      await promise;
      expect(receiver.onDelta.mock.calls.flat()).toEqual([" 첫 답변 ", "둘째"]);
    },
  );

  it("완료 뒤 연결을 기다리지 않고 수신을 취소한다", async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                conversation + delta("완료") + done + delta("늦은 답변"),
              ),
            );
          },
          cancel,
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    const { receiver, promise } = receive();
    await promise;
    expect(cancel).toHaveBeenCalledOnce();
    expect(receiver.onDelta).toHaveBeenCalledExactlyOnceWith("완료");
  });

  it.each([
    conversation + delta("중간 답변"),
    conversation +
      delta("중간 답변") +
      'event: done\ndata: {"conversationId":"' +
      id +
      '"}',
    conversation +
      delta("중간 답변") +
      'event: failure\ndata: {"message":"secret upstream error"}\n\n',
  ])(
    "실패와 완료 이벤트 없이 끊긴 응답을 성공으로 처리하지 않는다",
    async (text) => {
      fetchMock.mockResolvedValue(response([encoder.encode(text)]));
      const { receiver, promise } = receive();
      await expect(promise).rejects.toBeInstanceOf(AiChatApiError);
      expect(receiver.onDelta).toHaveBeenCalledWith("중간 답변");
    },
  );

  it.each([
    conversation + "event: delta\ndata: invalid-json\n\n",
    conversation + 'event: delta\ndata: {"text":123}\n\n',
    delta("대화 ID 없음") + done,
    conversation +
      delta("답변") +
      `event: done\ndata: {"conversationId":"${otherId}"}\n\n`,
    conversation + done,
    conversation + delta(" \n ") + done,
    'event: conversation\ndata: {"conversationId":"invalid"}\n\n',
  ])("잘못된 이벤트와 빈 답변을 실패로 처리한다", async (text) => {
    fetchMock.mockResolvedValue(response([encoder.encode(text)]));
    await expect(receive().promise).rejects.toBeInstanceOf(AiChatApiError);
  });

  it("요청한 대화와 다른 ID의 응답을 전달하지 않는다", async () => {
    fetchMock.mockResolvedValue(
      response([encoder.encode(conversation + delta("답변") + done)]),
    );
    const { receiver, promise } = receive(otherId);
    await expect(promise).rejects.toBeInstanceOf(AiChatApiError);
    expect(receiver.onConversation).not.toHaveBeenCalled();
    expect(receiver.onDelta).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 500])(
    "HTTP %s를 안전한 오류로 전달한다",
    async (status) => {
      fetchMock.mockResolvedValue(new Response("secret response", { status }));
      await expect(receive().promise).rejects.toMatchObject({
        status,
        message: "AI 답변을 끝까지 받지 못했습니다.",
      });
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it.each([
    new Response("{}", { headers: { "Content-Type": "application/json" } }),
    new Response(null, { headers: { "Content-Type": "text/event-stream" } }),
  ])("스트림이 아닌 응답을 거부한다", async (result) => {
    fetchMock.mockResolvedValue(result);
    await expect(receive().promise).rejects.toBeInstanceOf(AiChatApiError);
  });

  it("네트워크 오류의 원문을 노출하지 않는다", async () => {
    fetchMock.mockRejectedValue(new Error("secret network error"));
    await expect(receive().promise).rejects.toMatchObject({
      message: "AI 답변을 끝까지 받지 못했습니다.",
    });
  });

  it.each(["", " \n ", "가".repeat(4001)])(
    "유효하지 않은 입력은 요청하지 않는다",
    async (message) => {
      await expect(
        streamAiChat(
          { message },
          { onConversation: vi.fn(), onDelta: vi.fn() },
          new AbortController().signal,
        ),
      ).rejects.toBeInstanceOf(AiChatApiError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("수신 대기 중 취소하면 스트림과 타이머를 정리한다", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(new ReadableStream({ cancel }), {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    const { controller, promise } = receive();
    const rejection = expect(promise).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    controller.abort();
    await rejection;
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("전체 제한 시간이 지나면 수신을 끝내고 재요청하지 않는다", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(new ReadableStream({ cancel }), {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    const { promise } = receive();
    const rejection = expect(promise).rejects.toBeInstanceOf(AiChatApiError);
    await vi.advanceTimersByTimeAsync(45_000);
    await rejection;
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
