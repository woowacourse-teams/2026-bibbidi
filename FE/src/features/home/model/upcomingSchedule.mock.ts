import { homeDashboardReferenceDateMock } from "./homeDashboardReferenceDate.mock";
import { UpcomingScheduleListModel } from "./upcomingSchedule";

export const upcomingScheduleListMock: UpcomingScheduleListModel = {
  referenceDate: homeDashboardReferenceDateMock,
  schedules: [
    {
      date: "2026-08-25",
      id: "venue-contract-review",
      location: "서초구",
      status: "in-progress",
      time: "15:00",
      title: "예식장 계약서 최종 검토",
    },
    {
      date: "2026-08-27",
      id: "studio-consultation",
      location: "강남구",
      status: "upcoming",
      time: "14:00",
      title: "스튜디오 촬영 상담",
    },
    {
      date: "2026-08-30",
      id: "honeymoon-flight-consultation",
      location: "온라인",
      status: "upcoming",
      time: null,
      title: "신혼여행 항공권 상담",
    },
    {
      date: "2026-09-03",
      id: "invitation-sample-delivery",
      location: "자택",
      status: "upcoming",
      time: "13:00",
      title: "청첩장 샘플 수령",
    },
    {
      date: "2026-09-09",
      id: "hanbok-fitting",
      location: "종로구",
      status: "upcoming",
      time: "11:00",
      title: "혼주 한복 피팅",
    },
    {
      date: "2026-09-14",
      id: "family-meeting-venue-visit",
      location: "용산구",
      status: "upcoming",
      time: "18:30",
      title: "상견례 장소 답사",
    },
  ],
};
