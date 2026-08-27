import { RecommendedScheduleListModel } from "./recommendedSchedule";

export const recommendedScheduleListMock: RecommendedScheduleListModel = {
  schedules: [
    {
      category: "스드메",
      id: "dress-fitting-reservation",
      reason: "본식 드레스를 비교할 시기예요.",
      recommendedMonthsBefore: 5,
      title: "드레스 피팅 예약",
    },
    {
      category: "신혼여행",
      id: "passport-expiration-check",
      reason: "항공권 예약 전에 확인해요.",
      recommendedMonthsBefore: 6,
      title: "여권 만료일 확인",
    },
    {
      category: "상견례",
      id: "family-meeting-venue-reservation",
      reason: "양가 일정에 맞춰 미리 정해요.",
      recommendedMonthsBefore: 8,
      title: "상견례 장소 예약",
    },
    {
      category: "건강",
      id: "vaccination-check",
      reason: "여행지에 필요한 접종을 확인해요.",
      recommendedMonthsBefore: 3,
      title: "예방접종 확인",
    },
  ],
};
