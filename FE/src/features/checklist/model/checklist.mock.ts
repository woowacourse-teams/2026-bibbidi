import { ChecklistCategoryModel } from "./checklist";

export const checklistCategoriesMock: ChecklistCategoryModel[] = [
  {
    id: "planning-budget",
    title: "계획·예산",
    expanded: true,
    tasks: [
      {
        id: "plan-wedding-budget",
        title: "결혼예산표 계획",
        schedule: "8월 5일",
        status: "complete",
      },
      {
        id: "consult-wedding-planner",
        title: "웨딩플래너 상담",
        schedule: "8월 28일",
        status: "in-progress",
      },
      {
        id: "contract-wedding-planner",
        title: "웨딩플래너 계약",
        schedule: "일정 없음",
        status: "incomplete",
      },
    ],
  },
  {
    id: "families",
    title: "양가·가족",
    expanded: true,
    tasks: [
      {
        id: "greet-parents",
        title: "양가 부모님께 첫인사",
        schedule: "8월 10일",
        status: "complete",
      },
      {
        id: "family-meeting",
        title: "상견례",
        schedule: "9월 7일",
        status: "in-progress",
      },
      {
        id: "prepare-family-meeting-gift",
        title: "상견례 선물 준비",
        schedule: "일정 없음",
        status: "incomplete",
      },
    ],
  },
  {
    id: "wedding-hall",
    title: "예식장",
    expanded: true,
    tasks: [
      {
        id: "tour-wedding-hall",
        title: "웨딩홀 투어",
        schedule: "8월 20일",
        status: "complete",
      },
      {
        id: "contract-wedding-hall",
        title: "웨딩홀 계약",
        schedule: "8월 25일",
        status: "in-progress",
      },
      {
        id: "check-guaranteed-guests-and-meal-cost",
        title: "최소 보증 인원·식대 조건 확인",
        schedule: "일정 없음",
        status: "incomplete",
      },
      {
        id: "taste-wedding-meal",
        title: "웨딩홀 시식",
        schedule: "9월 14일",
        status: "incomplete",
      },
    ],
  },
  {
    id: "studio-dress-makeup",
    title: "스드메·촬영",
    expanded: true,
    tasks: [
      {
        id: "consult-studio-dress-makeup",
        title: "스드메 상담",
        schedule: "8월 18일",
        status: "complete",
      },
      {
        id: "contract-studio-dress-makeup",
        title: "스드메 계약",
        schedule: "9월 12일",
        status: "in-progress",
      },
      {
        id: "book-studio-shoot",
        title: "스튜디오 촬영 일정 예약",
        schedule: "일정 없음",
        status: "incomplete",
      },
    ],
  },
  {
    id: "outfit-jewelry",
    title: "의상·예물",
    expanded: false,
    tasks: [],
  },
  {
    id: "invitation-guests",
    title: "청첩장·하객",
    expanded: false,
    tasks: [],
  },
  {
    id: "ceremony",
    title: "본식 구성·진행",
    expanded: false,
    tasks: [],
  },
  {
    id: "honeymoon",
    title: "신혼여행",
    expanded: false,
    tasks: [],
  },
  {
    id: "newlywed-home",
    title: "신혼집·혼수",
    expanded: false,
    tasks: [],
  },
  {
    id: "pre-wedding-care",
    title: "웨딩 전 관리",
    expanded: false,
    tasks: [],
  },
  {
    id: "settlement-thanks",
    title: "정산·감사",
    expanded: false,
    tasks: [],
  },
];
