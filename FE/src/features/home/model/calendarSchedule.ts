export interface CalendarScheduleModel {
  checklistItemId?: number;
  startTime?: string | null;
  endTime?: string | null;
  place?: string | null;
  memo?: string | null;
  taskTitle?: string;
  date: string;
  id: number;
  title: string;
}
