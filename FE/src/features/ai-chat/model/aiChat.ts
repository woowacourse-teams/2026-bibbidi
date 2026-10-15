export const MAX_CHAT_MESSAGE_LENGTH = 4000;

export function isValidChatMessage(text: string): boolean {
  return Boolean(text.trim()) && text.length <= MAX_CHAT_MESSAGE_LENGTH;
}

export const suggestedQuestions = [
  "웨딩홀을 정한 다음엔 뭘 준비할까?",
  "촬영 전에 준비할 일을 정리해줘",
];

export type ChatMessage =
  | { id: number; role: "user"; text: string; time: string }
  | {
      id: number;
      role: "assistant";
      text: string;
      status: "streaming" | "complete" | "failed";
      catalogItemIds?: string[];
    };
