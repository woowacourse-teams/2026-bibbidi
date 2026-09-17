export interface UpcomingScheduleModel {
  date: string;
  id: number;
  place: string | null;
  startTime: string | null;
  title: string;
}

export interface UpcomingScheduleListModel {
  referenceDate: string;
  schedules: UpcomingScheduleModel[];
}
