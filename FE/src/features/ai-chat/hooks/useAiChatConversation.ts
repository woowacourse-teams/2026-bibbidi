import { useEffect, useRef, useState } from "react";

import { AiChatApiError, streamAiChat } from "../api/streamAiChat";
import {
  type ChatMessage,
  createUserChatMessage,
  isValidChatMessage,
} from "../model/aiChat";

type AssistantMessage = Extract<ChatMessage, { role: "assistant" }>;

export function useAiChatConversation(
  onAuthenticationRequired: () => void,
  contextLabel?: string,
  onRefresh?: () => void,
) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const conversationId = useRef<string | undefined>(undefined);
  const nextId = useRef(0);
  const failedTurn = useRef<{
    text: string;
    answerId: number;
    contextLabel?: string;
  } | null>(null);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      requestRef.current = null;
    },
    [],
  );

  const updateAnswer = (
    answerId: number,
    update: (message: AssistantMessage) => AssistantMessage,
  ) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === answerId && message.role === "assistant"
          ? update(message)
          : message,
      ),
    );
  };

  const receive = async (
    text: string,
    answerId: number,
    currentContext?: string,
  ) => {
    const controller = new AbortController();
    requestRef.current = controller;
    failedTurn.current = null;
    setErrorMessage(null);
    const updateCurrentAnswer = (
      update: (message: AssistantMessage) => AssistantMessage,
    ) => {
      if (requestRef.current !== controller) return;
      updateAnswer(answerId, update);
    };
    try {
      const contextualMessage = currentContext
        ? `[현재 화면: ${currentContext}]\n${text}`
        : text;
      await streamAiChat(
        {
          // Preserve the full question when context would exceed the API's limit.
          message: isValidChatMessage(contextualMessage)
            ? contextualMessage
            : text,
          conversationId: conversationId.current,
        },
        {
          onConversation: (id) => {
            if (requestRef.current === controller) conversationId.current = id;
          },
          onDelta: (delta) =>
            updateCurrentAnswer((message) => ({
              ...message,
              text: message.text + delta,
            })),
          onRefresh: () => {
            if (requestRef.current === controller) onRefresh?.();
          },
          onRecommendations: (catalogItemIds) =>
            updateCurrentAnswer((message) => ({ ...message, catalogItemIds })),
        },
        controller.signal,
      );
      updateCurrentAnswer((message) => ({ ...message, status: "complete" }));
    } catch (error) {
      if (requestRef.current !== controller) return;
      failedTurn.current = { text, answerId, contextLabel: currentContext };
      updateCurrentAnswer((message) => ({
        ...message,
        catalogItemIds: undefined,
        status: "failed",
      }));
      const authenticationRequired =
        error instanceof AiChatApiError && error.authenticationRequired;
      setErrorMessage(
        authenticationRequired
          ? "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요."
          : error instanceof AiChatApiError && error.capacityExceeded
            ? "요청이 많아 AI가 답변하지 못했습니다. 잠시 후 다시 시도해 주세요."
            : "답변을 끝까지 받지 못했어요. 다시 시도해 주세요.",
      );
      if (authenticationRequired) onAuthenticationRequired();
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  const send = (text: string) => {
    const content = text.trim();
    if (!isValidChatMessage(text) || requestRef.current) return;
    const id = nextId.current;
    nextId.current += 2;
    const userMessage = createUserChatMessage(id, content);
    setMessages((current) => [
      ...current,
      userMessage,
      { id: id + 1, role: "assistant", text: "", status: "streaming" },
    ]);
    setDraft("");
    void receive(content, id + 1, contextLabel);
  };

  const retry = () => {
    const turn = failedTurn.current;
    if (!turn || requestRef.current) return;
    updateAnswer(turn.answerId, (message) => ({
      ...message,
      text: "",
      catalogItemIds: undefined,
      status: "streaming",
    }));
    void receive(turn.text, turn.answerId, turn.contextLabel);
  };

  const isPending = messages.some(
    (message) => message.role === "assistant" && message.status === "streaming",
  );
  return { draft, messages, errorMessage, isPending, setDraft, send, retry };
}
