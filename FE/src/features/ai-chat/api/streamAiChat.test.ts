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
  const receiver = {
    onConversation: vi.fn(),
    onDelta: vi.fn(),
    onRecommendations: vi.fn(),
  };
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
  it("바이트 단위로 나뉜 추천 ID를 서버 순서대로 중복 제거해 전달한다", async () => {
    const bytes = encoder.encode(
      conversation +
        delta("추천해요") +
        'event: component\ndata: {"catalogItemIds":[201,101,201]}\n\n' +
        done,
    );
    fetchMock.mockResolvedValue(
      response(Array.from(bytes, (byte) => new Uint8Array([byte]))),
    );
    const { receiver, promise } = receive();
    await promise;
    expect(receiver.onRecommendations).toHaveBeenCalledExactlyOnceWith([
      "201",
      "101",
    ]);
  });

  it.each(
    [
      [0],
      [-1],
      [1.5],
      ["101"],
      [null],
      [Number.MAX_SAFE_INTEGER + 1],
      null,
    ].map((ids) => ({ ids })),
  )("잘못된 추천 ID $ids는 실패로 처리한다", async ({ ids }) => {
    fetchMock.mockResolvedValue(
      response([
        encoder.encode(
          conversation +
            delta("답변") +
            `event: component\ndata: ${JSON.stringify({ catalogItemIds: ids })}\n\n` +
            done,
        ),
      ]),
    );
    const { receiver, promise } = receive();
    await expect(promise).rejects.toBeInstanceOf(AiChatApiError);
    expect(receiver.onRecommendations).not.toHaveBeenCalled();
  });

  it("대화 시작 전 추천 이벤트는 받지 않는다", async () => {
    fetchMock.mockResolvedValue(
      response([
        encoder.encode(
          'event: component\ndata: {"catalogItemIds":[101]}\n\n' +
            conversation +
            delta("답변") +
            done,
        ),
      ]),
    );
    await expect(receive().promise).rejects.toBeInstanceOf(AiChatApiError);
  });

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

  it.each([901, 902, 999, 401])(
    "failure의 오류 코드 %s를 HTTP 상태와 분리해 전달한다",
    async (errorCode) => {
      fetchMock.mockResolvedValue(
        response([
          encoder.encode(
            conversation +
              delta("중간 답변") +
              `event: failure\ndata: ${JSON.stringify({ errorCode, message: "secret upstream error" })}\n\n` +
              done,
          ),
        ]),
      );
      const { receiver, promise } = receive();
      await expect(promise).rejects.toMatchObject({
        errorCode,
        status: undefined,
        authenticationRequired: false,
        capacityExceeded: errorCode === 902,
        message: "AI 답변을 끝까지 받지 못했습니다.",
      });
      expect(receiver.onDelta).toHaveBeenCalledExactlyOnceWith("중간 답변");
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it("대화 시작 전에 도착한 한도 초과도 구분한다", async () => {
    fetchMock.mockResolvedValue(
      response([
        encoder.encode(
          'event: failure\ndata: {"errorCode":902,"message":"secret upstream error"}\n\n',
        ),
      ]),
    );
    await expect(receive().promise).rejects.toMatchObject({
      errorCode: 902,
      capacityExceeded: true,
    });
  });

  it.each([
    '{"message":"secret upstream error"}',
    '{"errorCode":"902","message":"secret upstream error"}',
    '{"errorCode":902.5,"message":"secret upstream error"}',
    '{"errorCode":902}',
    '{"errorCode":902,"message":null}',
    "null",
    "[]",
    "invalid-json",
  ])("구형·잘못된 failure 데이터 %s는 공통 오류로 처리한다", async (data) => {
    fetchMock.mockResolvedValue(
      response([encoder.encode(`event: failure\ndata: ${data}\n\n`)]),
    );
    await expect(receive().promise).rejects.toMatchObject({
      errorCode: undefined,
      capacityExceeded: false,
      message: "AI 답변을 끝까지 받지 못했습니다.",
    });
  });

  it.each([400, 401, 403, 500, 503])(
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

  it.each(["done", "failure"])(
    "60초 시점에 도착한 %s 이벤트를 처리하고 타이머를 정리한다",
    async (terminalEvent) => {
      vi.useFakeTimers();
      let source!: ReadableStreamDefaultController<Uint8Array>;
      const cancel = vi.fn();
      fetchMock.mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              source = controller;
              controller.enqueue(encoder.encode(conversation));
            },
            cancel,
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        ),
      );
      const { receiver, promise } = receive();
      const settled = vi.fn();
      const completion = promise.then(
        () => settled("done"),
        () => settled("failure"),
      );
      await vi.advanceTimersByTimeAsync(60_000);
      expect(settled).not.toHaveBeenCalled();
      expect(cancel).not.toHaveBeenCalled();
      source.enqueue(
        encoder.encode(
          delta("늦게 도착한 답변") +
            (terminalEvent === "done"
              ? done
              : 'event: failure\ndata: {"errorCode":901,"message":"공개 실패 안내"}\n\n'),
        ),
      );
      await completion;
      expect(settled).toHaveBeenCalledExactlyOnceWith(terminalEvent);
      expect(receiver.onDelta).toHaveBeenCalledExactlyOnceWith(
        "늦게 도착한 답변",
      );
      expect(cancel).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("75초까지 완료·실패 이벤트가 없으면 수신을 끝내고 재요청하지 않는다", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(new ReadableStream({ cancel }), {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    const { promise } = receive();
    const rejection = expect(promise).rejects.toBeInstanceOf(AiChatApiError);
    await vi.advanceTimersByTimeAsync(74_999);
    expect(cancel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
