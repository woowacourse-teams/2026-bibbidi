export const suggestedQuestions = [
  "웨딩홀을 정한 다음엔 뭘 준비할까?",
  "촬영 전에 준비할 일을 정리해줘",
];

export const recommendedTasks = [
  { title: "주례 없는 예식 순서 정하기", step: "02 · 예식 진행 방식 결정" },
  { title: "사회자·축가 맡을 사람 정하기", step: "03 · 예식 진행 인원 섭외" },
];

export type ChatMessage =
  | { id: number; role: "user"; text: string; time: string }
  | {
      id: number;
      role: "assistant";
      kind: "guide" | "recommendations";
      text: string;
      cardIndex: number;
      feedback: string;
    };

export function createExampleReply(
  id: number,
  isFirstMessage: boolean,
): ChatMessage {
  return {
    id,
    role: "assistant",
    kind: isFirstMessage ? "guide" : "recommendations",
    text: isFirstMessage
      ? "웨딩홀을 정하셨군요! 이제 예식 진행 방식과 함께할 사람들을 정하면 좋아요."
      : "카드를 한 장씩 확인해보세요. 오른쪽은 추가, 왼쪽은 넘기기예요.",
    cardIndex: 0,
    feedback: "",
  };
}
