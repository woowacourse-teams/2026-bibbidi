import type { ChatMessage } from "./aiChat";

const COMPLETED_ANSWERS_BEFORE_FEEDBACK = 3;
export const AI_CHAT_FEEDBACK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function getAiChatFeedbackAnchor(messages: readonly ChatMessage[]) {
  return messages.filter(
    (message) =>
      message.role === "assistant" &&
      message.status === "complete" &&
      message.text.trim(),
  )[COMPLETED_ANSWERS_BEFORE_FEEDBACK - 1]?.id;
}
