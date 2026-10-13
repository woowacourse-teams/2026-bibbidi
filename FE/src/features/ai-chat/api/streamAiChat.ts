import { authenticatedFetch } from "../../../infrastructure/http/authenticatedFetch";
import { isValidChatMessage } from "../model/aiChat";
import { readSseEvents, SseEvent } from "./readSseEvents";

const CHAT_ENDPOINT = `${__BIBBIDI_API_BASE_URL__.replace(/\/+$/, "")}/api/ai/chat`;
// 서버의 30초 제한 뒤에도 완료/실패 이벤트가 도착하지 않으면 수신을 종료한다.
const CHAT_TIMEOUT_MS = 45_000;
const UUID_PATTERN = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export class AiChatApiError extends Error {
  constructor(readonly status?: number) {
    super("AI 답변을 끝까지 받지 못했습니다.");
    this.name = "AiChatApiError";
  }

  get authenticationRequired(): boolean {
    return this.status === 401;
  }
}

interface ChatRequest {
  message: string;
  conversationId?: string;
}

interface ChatReceiver {
  onConversation: (id: string) => void;
  onDelta: (text: string) => void;
}

function createChatEventHandler(request: ChatRequest, receiver: ChatReceiver) {
  let conversationId: string | undefined;
  let hasAnswer = false;

  return (event: SseEvent): boolean => {
    if (!["conversation", "delta", "done", "failure"].includes(event.type))
      return false;
    if (event.type === "failure") throw new AiChatApiError();
    const value: unknown = JSON.parse(event.data);
    if (typeof value !== "object" || value === null) throw new AiChatApiError();
    if (event.type === "delta") {
      if (
        !conversationId ||
        !("text" in value) ||
        typeof value.text !== "string"
      ) {
        throw new AiChatApiError();
      }
      hasAnswer ||= Boolean(value.text.trim());
      receiver.onDelta(value.text);
    } else {
      if (
        !("conversationId" in value) ||
        typeof value.conversationId !== "string" ||
        !UUID_PATTERN.test(value.conversationId)
      ) {
        throw new AiChatApiError();
      }
      if (event.type === "conversation") {
        if (
          conversationId ||
          (request.conversationId &&
            request.conversationId !== value.conversationId)
        ) {
          throw new AiChatApiError();
        }
        conversationId = value.conversationId;
        receiver.onConversation(conversationId);
      } else {
        if (conversationId !== value.conversationId || !hasAnswer)
          throw new AiChatApiError();
        return true;
      }
    }
    return false;
  };
}

export async function streamAiChat(
  request: ChatRequest,
  receiver: ChatReceiver,
  signal: AbortSignal,
): Promise<void> {
  if (!isValidChatMessage(request.message)) {
    throw new AiChatApiError();
  }
  signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timeout = window.setTimeout(abort, CHAT_TIMEOUT_MS);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancelReader = () => {
    void reader?.cancel().catch(() => {});
  };

  try {
    const response = await authenticatedFetch(CHAT_ENDPOINT, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new AiChatApiError(response.status);
    }
    if (
      response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "text/event-stream" ||
      !response.body
    ) {
      await response.body?.cancel();
      throw new AiChatApiError();
    }

    reader = response.body.getReader();
    controller.signal.addEventListener("abort", cancelReader, { once: true });
    const completed = await readSseEvents(
      reader,
      createChatEventHandler(request, receiver),
      controller.signal,
    );
    if (!completed) throw new AiChatApiError();
  } catch (error) {
    if (signal.aborted) signal.throwIfAborted();
    if (error instanceof AiChatApiError) throw error;
    throw new AiChatApiError();
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", cancelReader);
    await reader?.cancel().catch(() => {});
    reader?.releaseLock();
  }
}
