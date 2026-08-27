export interface RecommendedScheduleModel {
  category: string;
  id: string;
  reason: string;
  recommendedMonthsBefore: number;
  title: string;
}

export interface RecommendedScheduleListModel {
  schedules: RecommendedScheduleModel[];
}
