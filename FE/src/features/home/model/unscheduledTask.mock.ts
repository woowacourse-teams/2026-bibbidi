import { UnscheduledTaskListModel } from "./unscheduledTask";

export const unscheduledTaskListMock: UnscheduledTaskListModel = {
  tasks: [
    {
      category: "청첩장",
      id: "invitation-wording",
      status: "in-progress",
      title: "청첩장 문구 정하기",
    },
    {
      category: "신혼여행",
      id: "honeymoon-draft",
      status: "in-progress",
      title: "여행 일정 초안 만들기",
    },
    {
      category: "하객",
      id: "guest-list-draft",
      status: "in-progress",
      title: "하객 명단 1차 정리",
    },
    {
      category: "예단·예물",
      id: "wedding-gift-comparison",
      status: "in-progress",
      title: "예물 후보 비교하기",
    },
    {
      category: "본식",
      id: "ceremony-order",
      status: "in-progress",
      title: "본식 진행 순서 정리",
    },
  ],
};
