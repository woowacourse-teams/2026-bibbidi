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
      loginRequired?: boolean;
    };

export function createUserChatMessage(
  id: number,
  text: string,
): Extract<ChatMessage, { role: "user" }> {
  return {
    id,
    role: "user",
    text,
    time: new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
}

export function createGuestChatMessages(
  question: string,
): ChatMessage[] | null {
  if (!suggestedQuestions.includes(question)) return null;
  return [
    createUserChatMessage(0, question),
    {
      id: 1,
      role: "assistant",
      text: "로그인하면 나에게 맞는 준비를 추천받을 수 있어요.",
      status: "complete",
      loginRequired: true,
    },
  ];
}
