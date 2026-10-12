import { useState } from "react";

import {
  ChatMessage,
  ExampleRecommendedTask,
  createExampleReply,
  recommendedTasks,
} from "../model/exampleChat";

export function useAiChatConversation(
  onTaskAdd: (task: ExampleRecommendedTask) => boolean,
) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const send = (text: string) => {
    const content = text.trim();
    if (!content) return;
    const time = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    setMessages((current) => [
      ...current,
      { id: current.length, role: "user", text: content, time },
      createExampleReply(current.length + 1, current.length === 0),
    ]);
    setDraft("");
  };

  const chooseCard = (messageId: number, add: boolean) => {
    const message = messages.find((item) => item.id === messageId);
    if (message?.role !== "assistant" || message.kind !== "recommendations")
      return;
    const task = recommendedTasks[message.cardIndex];
    if (!task) return;
    const alreadyAdded = add && !onTaskAdd(task);
    setMessages((current) =>
      current.map((message) => {
        if (
          message.id !== messageId ||
          message.role !== "assistant" ||
          message.kind !== "recommendations"
        )
          return message;
        const task = recommendedTasks[message.cardIndex];
        if (!task) return message;
        return {
          ...message,
          cardIndex: message.cardIndex + 1,
          feedback: add
            ? `${alreadyAdded ? "이미 예시로 추가했어요" : "예시로 추가했어요"}: ${task.title}`
            : `넘겼어요: ${task.title}`,
        };
      }),
    );
  };

  return { draft, messages, setDraft, send, chooseCard };
}
