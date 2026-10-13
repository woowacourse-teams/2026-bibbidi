import { suggestedQuestions } from "../ai-chat/model/aiChat";

export const landingChatExamples = [
  {
    question: suggestedQuestions[0],
    reply: [
      "웨딩홀을 정하셨군요!",
      "이제 예식 진행 방식과 함께할 사람들을 정하면 좋아요.",
    ],
    tasks: [
      { title: "주례 없는 예식 순서 정하기", step: "02 · 예식 진행 방식 결정" },
      {
        title: "사회자·축가 맡을 사람 정하기",
        step: "03 · 예식 진행 인원 섭외",
      },
    ],
  },
  {
    question: suggestedQuestions[1],
    reply: [
      "촬영을 앞두고 계시군요!",
      "원하는 분위기를 정하고, 촬영에 필요한 의상과 소품을 챙겨보세요.",
    ],
    tasks: [
      { title: "촬영 콘셉트 정하기", step: "촬영 준비 · 원하는 분위기 찾기" },
      { title: "촬영 의상과 소품 챙기기", step: "촬영 준비 · 준비물 확인" },
    ],
  },
];
