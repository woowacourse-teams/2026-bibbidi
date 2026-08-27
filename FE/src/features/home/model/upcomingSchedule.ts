export type UpcomingScheduleStatus = "in-progress" | "upcoming";

export interface UpcomingScheduleModel {
  date: string;
  id: string;
  location: string;
  status: UpcomingScheduleStatus;
  time: string | null;
  title: string;
}

export interface UpcomingScheduleListModel {
  referenceDate: string;
  schedules: UpcomingScheduleModel[];
}
